/**
 * Comprehensive Tests for Test Utils Module
 * Tests all utility functions for image recognition testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    calculateAccuracyMetrics,
    calculateF1Score,
    detectResolution,
    detectUILayout,
    generateTestReport,
    getTestImageURLs,
    compareDetectionResults,
    type TestResult,
    type GroundTruth,
} from '../../src/modules/test-utils.ts';

describe('Test Utils - Comprehensive Tests', () => {
    describe('calculateAccuracyMetrics', () => {
        it('should calculate perfect accuracy when all matches', () => {
            const detected = [
                { entity: { name: 'Battery' }, confidence: 0.9 },
                { entity: { name: 'Gym Sauce' }, confidence: 0.95 },
            ];
            const groundTruth = ['Battery', 'Gym Sauce'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.accuracy).toBe(1);
            expect(metrics.precision).toBe(1);
            expect(metrics.recall).toBe(1);
            expect(metrics.truePositives).toBe(2);
            expect(metrics.falsePositives).toBe(0);
            expect(metrics.falseNegatives).toBe(0);
        });

        it('should handle case insensitive matching', () => {
            const detected = [
                { entity: { name: 'BATTERY' }, confidence: 0.9 },
                { entity: { name: 'gym sauce' }, confidence: 0.95 },
            ];
            const groundTruth = ['battery', 'Gym Sauce'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.accuracy).toBe(1);
            expect(metrics.truePositives).toBe(2);
        });

        it('should count false positives correctly', () => {
            const detected = [
                { entity: { name: 'Battery' }, confidence: 0.9 },
                { entity: { name: 'Wrong Item' }, confidence: 0.8 },
            ];
            const groundTruth = ['Battery'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.truePositives).toBe(1);
            expect(metrics.falsePositives).toBe(1);
            expect(metrics.falseNegatives).toBe(0);
            expect(metrics.precision).toBe(0.5); // 1/(1+1)
            expect(metrics.recall).toBe(1); // 1/(1+0)
        });

        it('should count false negatives correctly', () => {
            const detected = [
                { entity: { name: 'Battery' }, confidence: 0.9 },
            ];
            const groundTruth = ['Battery', 'Gym Sauce'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.truePositives).toBe(1);
            expect(metrics.falsePositives).toBe(0);
            expect(metrics.falseNegatives).toBe(1);
            expect(metrics.precision).toBe(1); // 1/(1+0)
            expect(metrics.recall).toBe(0.5); // 1/(1+1)
        });

        it('should handle empty detected array', () => {
            const detected: any[] = [];
            const groundTruth = ['Battery', 'Gym Sauce'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.accuracy).toBe(0);
            expect(metrics.precision).toBe(0);
            expect(metrics.recall).toBe(0);
            expect(metrics.truePositives).toBe(0);
            expect(metrics.falseNegatives).toBe(2);
        });

        it('should handle empty ground truth array', () => {
            const detected = [
                { entity: { name: 'Battery' }, confidence: 0.9 },
            ];
            const groundTruth: string[] = [];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.precision).toBe(0);
            expect(metrics.recall).toBe(0);
            expect(metrics.falsePositives).toBe(1);
        });

        it('should handle both arrays empty', () => {
            const detected: any[] = [];
            const groundTruth: string[] = [];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            expect(metrics.accuracy).toBe(0);
            expect(metrics.precision).toBe(0);
            expect(metrics.recall).toBe(0);
        });

        it('should calculate accuracy correctly with mixed results', () => {
            const detected = [
                { entity: { name: 'Battery' }, confidence: 0.9 },
                { entity: { name: 'Gym Sauce' }, confidence: 0.95 },
                { entity: { name: 'Wrong Item' }, confidence: 0.7 },
            ];
            const groundTruth = ['Battery', 'Gym Sauce', 'Anvil'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);

            // TP=2, FP=1, FN=1
            expect(metrics.truePositives).toBe(2);
            expect(metrics.falsePositives).toBe(1);
            expect(metrics.falseNegatives).toBe(1);
            expect(metrics.accuracy).toBe(2 / 4); // 2/(2+1+1)
            expect(metrics.precision).toBe(2 / 3); // 2/(2+1)
            expect(metrics.recall).toBe(2 / 3); // 2/(2+1)
        });
    });

    describe('calculateF1Score', () => {
        it('should calculate perfect F1 score', () => {
            const f1 = calculateF1Score(1, 1);
            expect(f1).toBe(1);
        });

        it('should calculate F1 score correctly', () => {
            const f1 = calculateF1Score(0.8, 0.6);
            // F1 = 2 * (0.8 * 0.6) / (0.8 + 0.6) = 0.96 / 1.4 ≈ 0.6857
            expect(f1).toBeCloseTo(0.6857, 3);
        });

        it('should return 0 when both precision and recall are 0', () => {
            const f1 = calculateF1Score(0, 0);
            expect(f1).toBe(0);
        });

        it('should handle one value being 0', () => {
            expect(calculateF1Score(1, 0)).toBe(0);
            expect(calculateF1Score(0, 1)).toBe(0);
        });

        it('should calculate harmonic mean correctly', () => {
            const f1 = calculateF1Score(0.5, 0.5);
            expect(f1).toBe(0.5);
        });
    });

    describe('detectResolution', () => {
        it('should detect Steam Deck resolution', () => {
            const res = detectResolution(1280, 800);
            expect(res.category).toBe('steam_deck');
            expect(res.width).toBe(1280);
            expect(res.height).toBe(800);
        });

        it('should detect 720p resolution', () => {
            const res = detectResolution(1280, 720);
            expect(res.category).toBe('720p');
        });

        it('should detect 720p with slight variance', () => {
            const res = detectResolution(1290, 730);
            expect(res.category).toBe('720p');
        });

        it('should detect 1080p resolution', () => {
            const res = detectResolution(1920, 1080);
            expect(res.category).toBe('1080p');
        });

        it('should detect 1080p with slight variance', () => {
            const res = detectResolution(1930, 1090);
            expect(res.category).toBe('1080p');
        });

        it('should detect 1440p resolution', () => {
            const res = detectResolution(2560, 1440);
            expect(res.category).toBe('1440p');
        });

        it('should detect 1440p with slight variance', () => {
            const res = detectResolution(2570, 1450);
            expect(res.category).toBe('1440p');
        });

        it('should detect 4K resolution', () => {
            const res = detectResolution(3840, 2160);
            expect(res.category).toBe('4K');
        });

        it('should detect 4K with slight variance', () => {
            const res = detectResolution(3850, 2170);
            expect(res.category).toBe('4K');
        });

        it('should return custom for non-standard resolution', () => {
            const res = detectResolution(1366, 768);
            expect(res.category).toBe('custom');
            expect(res.width).toBe(1366);
            expect(res.height).toBe(768);
        });

        it('should return custom for very different resolutions', () => {
            const res = detectResolution(800, 600);
            expect(res.category).toBe('custom');
        });
    });

    describe('detectUILayout', () => {
        it('should detect Steam Deck layout (16:10 aspect ratio)', () => {
            const layout = detectUILayout(1280, 800);
            expect(layout).toBe('steam_deck');
        });

        it('should detect PC layout (16:9 aspect ratio)', () => {
            const layout = detectUILayout(1920, 1080);
            expect(layout).toBe('pc');
        });

        it('should detect PC layout for 720p', () => {
            const layout = detectUILayout(1280, 720);
            expect(layout).toBe('pc');
        });

        it('should detect PC layout for 1440p', () => {
            const layout = detectUILayout(2560, 1440);
            expect(layout).toBe('pc');
        });

        it('should detect PC layout for 4K', () => {
            const layout = detectUILayout(3840, 2160);
            expect(layout).toBe('pc');
        });

        it('should return unknown for non-standard aspect ratios', () => {
            // 21:9 ultrawide ratio (2.333...) - neither 16:9 nor 16:10
            const layout = detectUILayout(2560, 1080);
            expect(layout).toBe('unknown');
        });

        it('should return unknown for 4:3 aspect ratio', () => {
            const layout = detectUILayout(1024, 768);
            expect(layout).toBe('unknown');
        });

        it('should handle aspect ratios near 16:10', () => {
            const layout = detectUILayout(1600, 1000);
            expect(layout).toBe('steam_deck');
        });

        it('should handle aspect ratios near 16:9', () => {
            const layout = detectUILayout(1920, 1082);
            expect(layout).toBe('pc');
        });
    });

    describe('generateTestReport', () => {
        const mockResults: TestResult[] = [
            {
                imageName: 'test1.png',
                resolution: '1920x1080',
                uiLayout: 'pc',
                detectionMode: 'ocr',
                expectedItems: ['Battery', 'Gym Sauce'],
                detectedItems: ['Battery', 'Gym Sauce'],
                accuracy: 1.0,
                precision: 1.0,
                recall: 1.0,
                confidenceScores: [0.9, 0.95],
                processingTime: 150,
                errors: [],
            },
            {
                imageName: 'test2.png',
                resolution: '1280x800',
                uiLayout: 'steam_deck',
                detectionMode: 'hybrid',
                expectedItems: ['Anvil', 'Jetpack'],
                detectedItems: ['Anvil'],
                accuracy: 0.5,
                precision: 1.0,
                recall: 0.5,
                confidenceScores: [0.85],
                processingTime: 200,
                errors: ['Missed item: Jetpack'],
            },
        ];

        it('should generate report with header', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('# MegaBonk Image Recognition Test Report');
            expect(report).toContain('**Total Tests:** 2');
        });

        it('should include overall performance stats', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('## Overall Performance');
            expect(report).toContain('**Average Accuracy:**');
            expect(report).toContain('**Average Precision:**');
            expect(report).toContain('**Average Recall:**');
            expect(report).toContain('**Average Processing Time:**');
        });

        it('should calculate average accuracy correctly', () => {
            const report = generateTestReport(mockResults);
            // (1.0 + 0.5) / 2 = 0.75 = 75%
            expect(report).toContain('75.00%');
        });

        it('should include performance by resolution', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('## Performance by Resolution');
            expect(report).toContain('1920x1080');
            expect(report).toContain('1280x800');
        });

        it('should include performance by UI layout', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('## Performance by UI Layout');
            expect(report).toContain('pc');
            expect(report).toContain('steam_deck');
        });

        it('should include performance by detection mode', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('## Performance by Detection Mode');
            expect(report).toContain('ocr');
            expect(report).toContain('hybrid');
        });

        it('should include individual test results', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('## Individual Test Results');
            expect(report).toContain('### Test 1: test1.png');
            expect(report).toContain('### Test 2: test2.png');
        });

        it('should include errors when present', () => {
            const report = generateTestReport(mockResults);
            expect(report).toContain('**Errors:** Missed item: Jetpack');
        });

        it('should handle single result', () => {
            const report = generateTestReport([mockResults[0]]);
            expect(report).toContain('**Total Tests:** 1');
            expect(report).toContain('100.00%'); // 100% accuracy
        });

        it('should handle results with zero accuracy', () => {
            const zeroResult: TestResult = {
                ...mockResults[0],
                accuracy: 0,
                precision: 0,
                recall: 0,
            };
            const report = generateTestReport([zeroResult]);
            expect(report).toContain('0.00%');
        });
    });

    describe('getTestImageURLs', () => {
        it('should return array of test images', () => {
            const urls = getTestImageURLs();
            expect(Array.isArray(urls)).toBe(true);
            expect(urls.length).toBeGreaterThan(0);
        });

        it('should include PC 1080p test', () => {
            const urls = getTestImageURLs();
            const pc1080p = urls.find(u => u.name === 'pc_1080p_pause_menu');
            expect(pc1080p).toBeDefined();
            expect(pc1080p?.resolution).toBe('1920x1080');
            expect(pc1080p?.type).toBe('pause_menu');
        });

        it('should include Steam Deck test', () => {
            const urls = getTestImageURLs();
            const steamDeck = urls.find(u => u.name === 'steam_deck_pause_menu');
            expect(steamDeck).toBeDefined();
            expect(steamDeck?.resolution).toBe('1280x800');
        });

        it('should include gameplay test', () => {
            const urls = getTestImageURLs();
            const gameplay = urls.find(u => u.type === 'gameplay');
            expect(gameplay).toBeDefined();
        });

        it('should have ground truth for each image', () => {
            const urls = getTestImageURLs();
            urls.forEach(img => {
                expect(img.groundTruth).toBeDefined();
                expect(img.groundTruth.items).toBeDefined();
                expect(Array.isArray(img.groundTruth.items)).toBe(true);
            });
        });

        it('should have valid URLs', () => {
            const urls = getTestImageURLs();
            urls.forEach(img => {
                expect(img.url).toBeDefined();
                expect(img.url).toContain('/test-images/');
            });
        });

        it('should have unique names', () => {
            const urls = getTestImageURLs();
            const names = urls.map(u => u.name);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });
    });

    describe('compareDetectionResults', () => {
        it('should find items only in first result', () => {
            const result1 = {
                name: 'OCR',
                items: [
                    { entity: { name: 'Battery' } },
                    { entity: { name: 'Gym Sauce' } },
                ],
            };
            const result2 = {
                name: 'CV',
                items: [
                    { entity: { name: 'Battery' } },
                ],
            };

            const comparison = compareDetectionResults(result1, result2);
            expect(comparison.onlyIn1).toEqual(['Gym Sauce']);
        });

        it('should find items only in second result', () => {
            const result1 = {
                name: 'OCR',
                items: [
                    { entity: { name: 'Battery' } },
                ],
            };
            const result2 = {
                name: 'CV',
                items: [
                    { entity: { name: 'Battery' } },
                    { entity: { name: 'Anvil' } },
                ],
            };

            const comparison = compareDetectionResults(result1, result2);
            expect(comparison.onlyIn2).toEqual(['Anvil']);
        });

        it('should find items in both results', () => {
            const result1 = {
                name: 'OCR',
                items: [
                    { entity: { name: 'Battery' } },
                    { entity: { name: 'Gym Sauce' } },
                ],
            };
            const result2 = {
                name: 'CV',
                items: [
                    { entity: { name: 'Battery' } },
                    { entity: { name: 'Gym Sauce' } },
                ],
            };

            const comparison = compareDetectionResults(result1, result2);
            expect(comparison.inBoth).toEqual(['Battery', 'Gym Sauce']);
            expect(comparison.agreement).toBe(1);
        });

        it('should calculate agreement correctly', () => {
            const result1 = {
                name: 'OCR',
                items: [
                    { entity: { name: 'Battery' } },
                    { entity: { name: 'Gym Sauce' } },
                ],
            };
            const result2 = {
                name: 'CV',
                items: [
                    { entity: { name: 'Battery' } },
                ],
            };

            const comparison = compareDetectionResults(result1, result2);
            // 1 in both, max length is 2, so 1/2 = 0.5
            expect(comparison.agreement).toBe(0.5);
        });

        it('should handle no matches', () => {
            const result1 = {
                name: 'OCR',
                items: [
                    { entity: { name: 'Battery' } },
                ],
            };
            const result2 = {
                name: 'CV',
                items: [
                    { entity: { name: 'Anvil' } },
                ],
            };

            const comparison = compareDetectionResults(result1, result2);
            expect(comparison.inBoth).toEqual([]);
            expect(comparison.agreement).toBe(0);
        });

        it('should handle empty results', () => {
            const result1 = { name: 'OCR', items: [] };
            const result2 = { name: 'CV', items: [] };

            const comparison = compareDetectionResults(result1, result2);
            expect(comparison.onlyIn1).toEqual([]);
            expect(comparison.onlyIn2).toEqual([]);
            expect(comparison.inBoth).toEqual([]);
            expect(comparison.agreement).toBe(0);
        });

        it('should handle one empty result', () => {
            const result1 = {
                name: 'OCR',
                items: [{ entity: { name: 'Battery' } }],
            };
            const result2 = { name: 'CV', items: [] };

            const comparison = compareDetectionResults(result1, result2);
            expect(comparison.onlyIn1).toEqual(['Battery']);
            expect(comparison.onlyIn2).toEqual([]);
            expect(comparison.agreement).toBe(0);
        });

        it('should handle duplicate items in results', () => {
            const result1 = {
                name: 'OCR',
                items: [
                    { entity: { name: 'Battery' } },
                    { entity: { name: 'Battery' } },
                ],
            };
            const result2 = {
                name: 'CV',
                items: [
                    { entity: { name: 'Battery' } },
                ],
            };

            const comparison = compareDetectionResults(result1, result2);
            // Both arrays include Battery, so it should be in inBoth
            expect(comparison.inBoth.length).toBeGreaterThan(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large detection arrays', () => {
            const detected = Array(1000)
                .fill(null)
                .map((_, i) => ({ entity: { name: `Item${i}` }, confidence: 0.9 }));
            const groundTruth = detected.map(d => d.entity.name);

            const metrics = calculateAccuracyMetrics(detected, groundTruth);
            expect(metrics.accuracy).toBe(1);
            expect(metrics.truePositives).toBe(1000);
        });

        it('should handle unicode in item names', () => {
            const detected = [{ entity: { name: '🔋 Battery' }, confidence: 0.9 }];
            const groundTruth = ['🔋 Battery'];

            const metrics = calculateAccuracyMetrics(detected, groundTruth);
            expect(metrics.accuracy).toBe(1);
        });

        it('should handle resolution detection at boundaries', () => {
            // Just inside 720p tolerance (1280 ± 50, using < 50 check)
            const res1 = detectResolution(1329, 769);
            expect(res1.category).toBe('720p');

            const res2 = detectResolution(1231, 671);
            expect(res2.category).toBe('720p');

            // At exact boundary (50 away) - not matched since check is < 50
            const res3 = detectResolution(1330, 720);
            expect(res3.category).toBe('custom');
        });
    });
});
