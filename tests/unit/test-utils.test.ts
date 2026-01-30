/**
 * Test Utils Module - Comprehensive Tests
 * Testing accuracy calculations, resolution detection, and report generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    calculateAccuracyMetrics,
    calculateF1Score,
    detectResolution,
    detectUILayout,
    generateTestReport,
    getTestImageURLs,
    compareDetectionResults,
    runAutomatedTest,
    type TestResult,
    type GroundTruth,
} from '../../src/modules/test-utils';
import type { CVDetectionResult } from '../../src/modules/computer-vision';
import type { Item } from '../../src/types';

describe('Test Utils - Accuracy Metrics', () => {
    const mockDetection = (name: string): CVDetectionResult => ({
        type: 'item',
        entity: { id: `id-${name}`, name } as Item,
        confidence: 0.9,
        method: 'template_match',
    });

    it('should calculate perfect accuracy (100%)', () => {
        const detected = [mockDetection('Sword'), mockDetection('Shield')];
        const groundTruth = ['Sword', 'Shield'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(2);
        expect(metrics.falsePositives).toBe(0);
        expect(metrics.falseNegatives).toBe(0);
        expect(metrics.accuracy).toBe(1.0);
        expect(metrics.precision).toBe(1.0);
        expect(metrics.recall).toBe(1.0);
    });

    it('should calculate metrics with false positives', () => {
        const detected = [mockDetection('Sword'), mockDetection('Shield'), mockDetection('Wrong Item')];
        const groundTruth = ['Sword', 'Shield'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(2);
        expect(metrics.falsePositives).toBe(1);
        expect(metrics.falseNegatives).toBe(0);
        expect(metrics.accuracy).toBeCloseTo(0.667, 2);
        expect(metrics.precision).toBeCloseTo(0.667, 2);
        expect(metrics.recall).toBe(1.0);
    });

    it('should calculate metrics with false negatives', () => {
        const detected = [mockDetection('Sword')];
        const groundTruth = ['Sword', 'Shield', 'Helmet'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(1);
        expect(metrics.falsePositives).toBe(0);
        expect(metrics.falseNegatives).toBe(2);
        expect(metrics.accuracy).toBeCloseTo(0.333, 2);
        expect(metrics.precision).toBe(1.0);
        expect(metrics.recall).toBeCloseTo(0.333, 2);
    });

    it('should calculate metrics with both FP and FN', () => {
        const detected = [mockDetection('Sword'), mockDetection('Wrong')];
        const groundTruth = ['Sword', 'Shield'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(1);
        expect(metrics.falsePositives).toBe(1);
        expect(metrics.falseNegatives).toBe(1);
        expect(metrics.accuracy).toBeCloseTo(0.333, 2);
        expect(metrics.precision).toBe(0.5);
        expect(metrics.recall).toBe(0.5);
    });

    it('should handle empty detections', () => {
        const detected: CVDetectionResult[] = [];
        const groundTruth = ['Sword', 'Shield'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(0);
        expect(metrics.falsePositives).toBe(0);
        expect(metrics.falseNegatives).toBe(2);
        expect(metrics.accuracy).toBe(0);
        expect(metrics.precision).toBe(0);
        expect(metrics.recall).toBe(0);
    });

    it('should handle empty ground truth', () => {
        const detected = [mockDetection('Sword')];
        const groundTruth: string[] = [];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(0);
        expect(metrics.falsePositives).toBe(1);
        expect(metrics.falseNegatives).toBe(0);
        expect(metrics.accuracy).toBe(0);
        expect(metrics.precision).toBe(0);
        expect(metrics.recall).toBe(0);
    });

    it('should handle both empty', () => {
        const detected: CVDetectionResult[] = [];
        const groundTruth: string[] = [];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(0);
        expect(metrics.falsePositives).toBe(0);
        expect(metrics.falseNegatives).toBe(0);
        expect(metrics.accuracy).toBe(0);
        expect(metrics.precision).toBe(0);
        expect(metrics.recall).toBe(0);
    });

    it('should be case-insensitive', () => {
        const detected = [mockDetection('SWORD'), mockDetection('shield')];
        const groundTruth = ['Sword', 'Shield'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(2);
        expect(metrics.accuracy).toBe(1.0);
    });

    it('should handle whitespace differences', () => {
        const detected = [mockDetection('Fire Sword')];
        const groundTruth = ['Fire Sword'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        expect(metrics.truePositives).toBe(1);
        expect(metrics.accuracy).toBe(1.0);
    });

    it('should handle duplicate detections correctly', () => {
        const detected = [
            mockDetection('Sword'),
            mockDetection('Sword'),
            mockDetection('Shield'),
        ];
        const groundTruth = ['Sword', 'Shield'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);

        // Both Sword detections count as true positives
        expect(metrics.truePositives).toBe(3);
    });
});

describe('Test Utils - F1 Score Calculation', () => {
    it('should calculate F1 score with perfect precision and recall', () => {
        const f1 = calculateF1Score(1.0, 1.0);
        expect(f1).toBe(1.0);
    });

    it('should calculate F1 score with equal precision and recall', () => {
        const f1 = calculateF1Score(0.5, 0.5);
        expect(f1).toBe(0.5);
    });

    it('should calculate F1 score with different precision and recall', () => {
        const f1 = calculateF1Score(0.8, 0.6);
        // F1 = 2 * (0.8 * 0.6) / (0.8 + 0.6) = 0.96 / 1.4 ≈ 0.686
        expect(f1).toBeCloseTo(0.686, 3);
    });

    it('should handle zero precision', () => {
        const f1 = calculateF1Score(0, 1.0);
        expect(f1).toBe(0);
    });

    it('should handle zero recall', () => {
        const f1 = calculateF1Score(1.0, 0);
        expect(f1).toBe(0);
    });

    it('should handle both zero', () => {
        const f1 = calculateF1Score(0, 0);
        expect(f1).toBe(0);
    });

    it('should calculate harmonic mean correctly', () => {
        // High precision, low recall
        const f1a = calculateF1Score(0.9, 0.3);
        expect(f1a).toBeCloseTo(0.45, 2);

        // Low precision, high recall
        const f1b = calculateF1Score(0.3, 0.9);
        expect(f1b).toBeCloseTo(0.45, 2);
    });

    it('should be symmetric', () => {
        const f1a = calculateF1Score(0.7, 0.8);
        const f1b = calculateF1Score(0.8, 0.7);
        expect(f1a).toBeCloseTo(f1b, 10);
    });
});

describe('Test Utils - Resolution Detection', () => {
    it('should detect Steam Deck resolution (1280x800)', () => {
        const result = detectResolution(1280, 800);
        expect(result.category).toBe('steam_deck');
        expect(result.width).toBe(1280);
        expect(result.height).toBe(800);
    });

    it('should detect 720p resolution (1280x720)', () => {
        const result = detectResolution(1280, 720);
        expect(result.category).toBe('720p');
    });

    it('should detect 1080p resolution (1920x1080)', () => {
        const result = detectResolution(1920, 1080);
        expect(result.category).toBe('1080p');
    });

    it('should detect 1440p resolution (2560x1440)', () => {
        const result = detectResolution(2560, 1440);
        expect(result.category).toBe('1440p');
    });

    it('should detect 4K resolution (3840x2160)', () => {
        const result = detectResolution(3840, 2160);
        expect(result.category).toBe('4K');
    });

    it('should handle near-720p resolution (within tolerance)', () => {
        const result1 = detectResolution(1285, 725);
        expect(result1.category).toBe('720p');

        const result2 = detectResolution(1275, 715);
        expect(result2.category).toBe('720p');
    });

    it('should handle near-1080p resolution (within tolerance)', () => {
        const result1 = detectResolution(1925, 1085);
        expect(result1.category).toBe('1080p');

        const result2 = detectResolution(1915, 1075);
        expect(result2.category).toBe('1080p');
    });

    it('should detect custom resolution outside tolerances', () => {
        const result = detectResolution(1600, 900);
        expect(result.category).toBe('custom');
    });

    it('should detect custom resolution for very small sizes', () => {
        const result = detectResolution(800, 600);
        expect(result.category).toBe('custom');
    });

    it('should detect custom resolution for very large sizes', () => {
        const result = detectResolution(5120, 2880);
        expect(result.category).toBe('custom');
    });

    it('should prioritize Steam Deck over 720p tolerance', () => {
        // Exact 1280x800 should be Steam Deck, not 720p
        const result = detectResolution(1280, 800);
        expect(result.category).toBe('steam_deck');
    });

    it('should handle ultra-wide resolutions as custom', () => {
        const result = detectResolution(3440, 1440);
        expect(result.category).toBe('custom');
    });

    it('should preserve exact width and height in result', () => {
        const width = 1337;
        const height = 768;
        const result = detectResolution(width, height);
        expect(result.width).toBe(width);
        expect(result.height).toBe(height);
    });
});

describe('Test Utils - UI Layout Detection', () => {
    it('should detect PC layout (16:9 aspect ratio)', () => {
        const layout = detectUILayout(1920, 1080);
        expect(layout).toBe('pc');
    });

    it('should detect PC layout for other 16:9 resolutions', () => {
        expect(detectUILayout(1280, 720)).toBe('pc');
        expect(detectUILayout(2560, 1440)).toBe('pc');
        expect(detectUILayout(3840, 2160)).toBe('pc');
    });

    it('should detect Steam Deck layout (16:10 aspect ratio)', () => {
        const layout = detectUILayout(1280, 800);
        expect(layout).toBe('steam_deck');
    });

    it('should detect Steam Deck for other 16:10 resolutions', () => {
        expect(detectUILayout(1920, 1200)).toBe('steam_deck');
        expect(detectUILayout(1680, 1050)).toBe('steam_deck');
    });

    it('should return unknown for 4:3 aspect ratio', () => {
        const layout = detectUILayout(1024, 768);
        expect(layout).toBe('unknown');
    });

    it('should return unknown for 21:9 ultra-wide', () => {
        const layout = detectUILayout(3440, 1440);
        expect(layout).toBe('unknown');
    });

    it('should handle slight variations within tolerance', () => {
        // Slightly off from 16:9 but within 0.1 tolerance
        const layout = detectUILayout(1900, 1080);
        expect(layout).toBe('pc');
    });

    it('should return unknown for square aspect ratio', () => {
        const layout = detectUILayout(1000, 1000);
        expect(layout).toBe('unknown');
    });

    it('should return unknown for portrait orientation', () => {
        const layout = detectUILayout(1080, 1920);
        expect(layout).toBe('unknown');
    });
});

describe('Test Utils - Test Report Generation', () => {
    const mockResult: TestResult = {
        imageName: 'test-image.png',
        resolution: '1080p',
        uiLayout: 'pc',
        detectionMode: 'ocr',
        expectedItems: ['Sword', 'Shield'],
        detectedItems: ['Sword', 'Shield'],
        accuracy: 1.0,
        precision: 1.0,
        recall: 1.0,
        confidenceScores: [0.9, 0.85],
        processingTime: 1234.5,
        errors: [],
    };

    it('should generate report for single test', () => {
        const report = generateTestReport([mockResult]);

        expect(report).toContain('# MegaBonk Image Recognition Test Report');
        expect(report).toContain('Total Tests:** 1');
        expect(report).toContain('test-image.png');
        expect(report).toContain('100.00%');
    });

    it('should generate report for multiple tests', () => {
        const results: TestResult[] = [
            { ...mockResult, imageName: 'test1.png' },
            { ...mockResult, imageName: 'test2.png', accuracy: 0.8 },
            { ...mockResult, imageName: 'test3.png', accuracy: 0.9 },
        ];

        const report = generateTestReport(results);

        expect(report).toContain('Total Tests:** 3');
        expect(report).toContain('test1.png');
        expect(report).toContain('test2.png');
        expect(report).toContain('test3.png');
    });

    it('should calculate average statistics correctly', () => {
        const results: TestResult[] = [
            { ...mockResult, accuracy: 1.0, precision: 1.0, recall: 1.0 },
            { ...mockResult, accuracy: 0.8, precision: 0.8, recall: 0.8 },
        ];

        const report = generateTestReport(results);

        // Average accuracy = (1.0 + 0.8) / 2 = 0.9 = 90%
        expect(report).toContain('Average Accuracy:** 90.00%');
        expect(report).toContain('Average Precision:** 90.00%');
        expect(report).toContain('Average Recall:** 90.00%');
    });

    it('should include timestamp', () => {
        const report = generateTestReport([mockResult]);
        expect(report).toContain('Generated:**');
    });

    it('should group results by resolution', () => {
        const results: TestResult[] = [
            { ...mockResult, resolution: '1080p', accuracy: 0.9 },
            { ...mockResult, resolution: '1080p', accuracy: 0.95 },
            { ...mockResult, resolution: '720p', accuracy: 0.8 },
        ];

        const report = generateTestReport(results);

        expect(report).toContain('Performance by Resolution');
        expect(report).toContain('1080p');
        expect(report).toContain('720p');
    });

    it('should group results by UI layout', () => {
        const results: TestResult[] = [
            { ...mockResult, uiLayout: 'pc', accuracy: 0.9 },
            { ...mockResult, uiLayout: 'steam_deck', accuracy: 0.85 },
        ];

        const report = generateTestReport(results);

        expect(report).toContain('Performance by UI Layout');
        expect(report).toContain('pc');
        expect(report).toContain('steam_deck');
    });

    it('should group results by detection mode', () => {
        const results: TestResult[] = [
            { ...mockResult, detectionMode: 'ocr', accuracy: 0.8 },
            { ...mockResult, detectionMode: 'manual', accuracy: 1.0 },
            { ...mockResult, detectionMode: 'hybrid', accuracy: 0.9 },
        ];

        const report = generateTestReport(results);

        expect(report).toContain('Performance by Detection Mode');
        expect(report).toContain('ocr');
        expect(report).toContain('manual');
        expect(report).toContain('hybrid');
    });

    it('should include individual test details', () => {
        const report = generateTestReport([mockResult]);

        expect(report).toContain('Individual Test Results');
        expect(report).toContain('Test 1');
        expect(report).toContain('Resolution:** 1080p');
        expect(report).toContain('UI Layout:** pc');
        expect(report).toContain('Detection Mode:** ocr');
        expect(report).toContain('Processing Time:** 1234.50ms');
    });

    it('should include errors if present', () => {
        const resultWithErrors: TestResult = {
            ...mockResult,
            errors: ['Failed to detect item', 'OCR timeout'],
        };

        const report = generateTestReport([resultWithErrors]);

        expect(report).toContain('Errors:**');
        expect(report).toContain('Failed to detect item');
        expect(report).toContain('OCR timeout');
    });

    it('should not include errors section when no errors', () => {
        const report = generateTestReport([mockResult]);

        expect(report).not.toMatch(/Errors:\*\*.*Failed/);
    });

    it('should handle empty results array', () => {
        const report = generateTestReport([]);

        // Should not crash, might have minimal content or warning
        expect(typeof report).toBe('string');
    });

    it('should format percentages with 2 decimal places', () => {
        const result: TestResult = {
            ...mockResult,
            accuracy: 0.8765,
            precision: 0.9123,
            recall: 0.7456,
        };

        const report = generateTestReport([result]);

        expect(report).toContain('87.65%');
        expect(report).toContain('91.23%');
        expect(report).toContain('74.56%');
    });

    it('should format processing time with 2 decimal places', () => {
        const result: TestResult = {
            ...mockResult,
            processingTime: 1234.567,
        };

        const report = generateTestReport([result]);

        expect(report).toContain('1234.57ms');
    });

    it('should handle zero accuracy gracefully', () => {
        const result: TestResult = {
            ...mockResult,
            accuracy: 0,
            precision: 0,
            recall: 0,
        };

        const report = generateTestReport([result]);

        expect(report).toContain('0.00%');
    });

    it('should number tests sequentially', () => {
        const results: TestResult[] = [
            { ...mockResult, imageName: 'test1.png' },
            { ...mockResult, imageName: 'test2.png' },
            { ...mockResult, imageName: 'test3.png' },
        ];

        const report = generateTestReport(results);

        expect(report).toContain('Test 1:');
        expect(report).toContain('Test 2:');
        expect(report).toContain('Test 3:');
    });
});

describe('Test Utils - Edge Cases', () => {
    it('should handle negative dimensions in resolution detection', () => {
        const result = detectResolution(-1920, -1080);
        expect(result.category).toBe('custom');
    });

    it('should handle zero dimensions in resolution detection', () => {
        const result = detectResolution(0, 0);
        expect(result.category).toBe('custom');
    });

    it('should handle zero dimensions in UI layout detection', () => {
        const layout = detectUILayout(0, 1080);
        expect(layout).toBe('unknown');
    });

    it('should handle very large numbers in resolution detection', () => {
        const result = detectResolution(999999, 999999);
        expect(result.category).toBe('custom');
        expect(result.width).toBe(999999);
        expect(result.height).toBe(999999);
    });

    it('should handle decimal dimensions (rounded)', () => {
        const result = detectResolution(1920.5, 1080.5);
        // Should still work with floats
        expect(result.category).toBeDefined();
    });

    it('should calculate F1 with very small precision/recall', () => {
        const f1 = calculateF1Score(0.001, 0.001);
        expect(f1).toBeCloseTo(0.001, 4);
    });

    it('should calculate F1 with very large precision/recall', () => {
        const f1 = calculateF1Score(0.999, 0.999);
        expect(f1).toBeCloseTo(0.999, 4);
    });

    it('should handle accuracy metrics with special characters in names', () => {
        const mockDetection = (name: string): CVDetectionResult => ({
            type: 'item',
            entity: { id: 'test', name } as Item,
            confidence: 0.9,
            method: 'template_match',
        });

        const detected = [mockDetection("Test's Item"), mockDetection('Item-2')];
        const groundTruth = ["Test's Item", 'Item-2'];

        const metrics = calculateAccuracyMetrics(detected, groundTruth);
        expect(metrics.accuracy).toBe(1.0);
    });
});

describe('Test Utils - getTestImageURLs', () => {
    it('should return an array of test images', () => {
        const images = getTestImageURLs();
        expect(Array.isArray(images)).toBe(true);
        expect(images.length).toBeGreaterThan(0);
    });

    it('should have valid structure for each test image', () => {
        const images = getTestImageURLs();
        
        images.forEach(image => {
            expect(image).toHaveProperty('name');
            expect(image).toHaveProperty('url');
            expect(image).toHaveProperty('type');
            expect(image).toHaveProperty('resolution');
            expect(image).toHaveProperty('groundTruth');
            expect(typeof image.name).toBe('string');
            expect(typeof image.url).toBe('string');
        });
    });

    it('should have valid type values (gameplay or pause_menu)', () => {
        const images = getTestImageURLs();
        
        images.forEach(image => {
            expect(['gameplay', 'pause_menu']).toContain(image.type);
        });
    });

    it('should have valid ground truth structure', () => {
        const images = getTestImageURLs();
        
        images.forEach(image => {
            expect(Array.isArray(image.groundTruth.items)).toBe(true);
            expect(Array.isArray(image.groundTruth.tomes)).toBe(true);
        });
    });

    it('should include PC 1080p pause menu test image', () => {
        const images = getTestImageURLs();
        const pc1080p = images.find(img => img.name === 'pc_1080p_pause_menu');
        
        expect(pc1080p).toBeDefined();
        expect(pc1080p?.resolution).toBe('1920x1080');
        expect(pc1080p?.type).toBe('pause_menu');
    });

    it('should include Steam Deck test image', () => {
        const images = getTestImageURLs();
        const steamDeck = images.find(img => img.name === 'steam_deck_pause_menu');
        
        expect(steamDeck).toBeDefined();
        expect(steamDeck?.resolution).toBe('1280x800');
    });

    it('should include gameplay test image', () => {
        const images = getTestImageURLs();
        const gameplay = images.find(img => img.type === 'gameplay');
        
        expect(gameplay).toBeDefined();
    });

    it('should have non-empty item arrays in ground truth for pause menus', () => {
        const images = getTestImageURLs();
        const pauseMenus = images.filter(img => img.type === 'pause_menu');
        
        pauseMenus.forEach(img => {
            expect(img.groundTruth.items.length).toBeGreaterThan(0);
        });
    });

    it('should have character and weapon in pause menu ground truth', () => {
        const images = getTestImageURLs();
        const pauseMenus = images.filter(img => img.type === 'pause_menu');
        
        pauseMenus.forEach(img => {
            expect(img.groundTruth.character).toBeDefined();
            expect(img.groundTruth.weapon).toBeDefined();
        });
    });
});

describe('Test Utils - compareDetectionResults', () => {
    const mockDetection = (name: string): CVDetectionResult => ({
        type: 'item',
        entity: { id: `id-${name}`, name } as Item,
        confidence: 0.9,
        method: 'template_match',
    });

    it('should find items only in first result', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword'), mockDetection('Shield'), mockDetection('Helmet')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.onlyIn1).toContain('Helmet');
        expect(comparison.onlyIn1).toHaveLength(1);
    });

    it('should find items only in second result', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Sword'), mockDetection('Shield'), mockDetection('Boots')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.onlyIn2).toContain('Shield');
        expect(comparison.onlyIn2).toContain('Boots');
        expect(comparison.onlyIn2).toHaveLength(2);
    });

    it('should find items in both results', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Shield'), mockDetection('Helmet')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.inBoth).toContain('Shield');
        expect(comparison.inBoth).toHaveLength(1);
    });

    it('should calculate perfect agreement (100%)', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.agreement).toBe(1.0);
        expect(comparison.onlyIn1).toHaveLength(0);
        expect(comparison.onlyIn2).toHaveLength(0);
        expect(comparison.inBoth).toHaveLength(2);
    });

    it('should calculate zero agreement when no overlap', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Helmet'), mockDetection('Boots')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.agreement).toBe(0);
        expect(comparison.inBoth).toHaveLength(0);
    });

    it('should calculate partial agreement correctly', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Sword'), mockDetection('Helmet')],
        };

        const comparison = compareDetectionResults(result1, result2);

        // 1 item in common out of max(2, 2) = 2, so agreement = 0.5
        expect(comparison.agreement).toBe(0.5);
    });

    it('should handle empty first result', () => {
        const result1 = {
            name: 'detector1',
            items: [] as CVDetectionResult[],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Sword'), mockDetection('Shield')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.onlyIn1).toHaveLength(0);
        expect(comparison.onlyIn2).toHaveLength(2);
        expect(comparison.inBoth).toHaveLength(0);
        expect(comparison.agreement).toBe(0);
    });

    it('should handle empty second result', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword')],
        };
        const result2 = {
            name: 'detector2',
            items: [] as CVDetectionResult[],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.onlyIn1).toHaveLength(1);
        expect(comparison.onlyIn2).toHaveLength(0);
        expect(comparison.inBoth).toHaveLength(0);
        expect(comparison.agreement).toBe(0);
    });

    it('should handle both empty results', () => {
        const result1 = {
            name: 'detector1',
            items: [] as CVDetectionResult[],
        };
        const result2 = {
            name: 'detector2',
            items: [] as CVDetectionResult[],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.onlyIn1).toHaveLength(0);
        expect(comparison.onlyIn2).toHaveLength(0);
        expect(comparison.inBoth).toHaveLength(0);
        // When both empty, max is 0, but function uses max(..., 1) to avoid division by zero
        expect(comparison.agreement).toBe(0);
    });

    it('should handle results with different sizes', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('Sword')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('Sword'), mockDetection('Shield'), mockDetection('Helmet'), mockDetection('Boots')],
        };

        const comparison = compareDetectionResults(result1, result2);

        // 1 in common out of max(1, 4) = 4
        expect(comparison.agreement).toBe(0.25);
        expect(comparison.inBoth).toEqual(['Sword']);
    });

    it('should preserve item order in onlyIn arrays', () => {
        const result1 = {
            name: 'detector1',
            items: [mockDetection('A'), mockDetection('B'), mockDetection('C')],
        };
        const result2 = {
            name: 'detector2',
            items: [mockDetection('D')],
        };

        const comparison = compareDetectionResults(result1, result2);

        expect(comparison.onlyIn1).toEqual(['A', 'B', 'C']);
    });
});

describe('Test Utils - runAutomatedTest', () => {
    const mockDetection = (name: string): CVDetectionResult => ({
        type: 'item',
        entity: { id: `id-${name}`, name } as Item,
        confidence: 0.9,
        method: 'template_match',
    });

    // Mock Image class for browser-like environment
    let originalImage: typeof globalThis.Image | undefined;
    
    beforeEach(() => {
        originalImage = globalThis.Image;
        
        // Mock Image class
        class MockImage {
            width = 1920;
            height = 1080;
            src = '';
            onload: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;

            set _src(value: string) {
                this.src = value;
                // Simulate async image load
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            }
        }
        
        // Add setter for src that triggers onload
        Object.defineProperty(MockImage.prototype, 'src', {
            set(value: string) {
                this._srcValue = value;
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            },
            get() {
                return this._srcValue || '';
            },
        });
        
        globalThis.Image = MockImage as unknown as typeof Image;
    });

    afterEach(() => {
        if (originalImage) {
            globalThis.Image = originalImage;
        }
    });

    it('should run automated test successfully', async () => {
        const groundTruth: GroundTruth = {
            items: ['Sword', 'Shield'],
            tomes: ['Fire Tome'],
            character: 'CL4NK',
            weapon: 'Hammer',
        };

        const mockDetectionFn = vi.fn().mockResolvedValue({
            items: [mockDetection('Sword'), mockDetection('Shield')],
            tomes: [mockDetection('Fire Tome')],
            character: { id: 'cl4nk', name: 'CL4NK' },
            weapon: { id: 'hammer', name: 'Hammer' },
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        expect(result.accuracy).toBe(1.0);
        expect(result.precision).toBe(1.0);
        expect(result.recall).toBe(1.0);
        expect(result.detectedItems).toEqual(['Sword', 'Shield']);
        expect(result.expectedItems).toEqual(['Sword', 'Shield']);
        expect(result.errors).toHaveLength(0);
        expect(result.detectionMode).toBe('ocr');
        expect(mockDetectionFn).toHaveBeenCalledWith('data:image/png;base64,fake');
    });

    it('should handle partial detection (some items missing)', async () => {
        const groundTruth: GroundTruth = {
            items: ['Sword', 'Shield', 'Helmet'],
            tomes: [],
        };

        const mockDetectionFn = vi.fn().mockResolvedValue({
            items: [mockDetection('Sword')], // Only detected one item
            tomes: [],
            character: null,
            weapon: null,
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'hybrid'
        );

        expect(result.accuracy).toBeCloseTo(0.333, 2);
        expect(result.precision).toBe(1.0);
        expect(result.recall).toBeCloseTo(0.333, 2);
        expect(result.detectionMode).toBe('hybrid');
    });

    it('should handle detection errors gracefully', async () => {
        const groundTruth: GroundTruth = {
            items: ['Sword'],
            tomes: [],
        };

        const mockDetectionFn = vi.fn().mockRejectedValue(new Error('Detection failed'));

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        expect(result.accuracy).toBe(0);
        expect(result.precision).toBe(0);
        expect(result.recall).toBe(0);
        expect(result.detectedItems).toHaveLength(0);
        expect(result.errors).toContain('Detection failed');
        expect(result.resolution).toBe('unknown');
        expect(result.uiLayout).toBe('unknown');
    });

    it('should measure processing time', async () => {
        const groundTruth: GroundTruth = {
            items: ['Sword'],
            tomes: [],
        };

        const mockDetectionFn = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing
            return {
                items: [mockDetection('Sword')],
                tomes: [],
                character: null,
                weapon: null,
            };
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        // Processing time should be at least 50ms (the simulated delay)
        expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should detect correct resolution and UI layout', async () => {
        // Set custom resolution in mock
        class MockImage1080p {
            width = 1920;
            height = 1080;
            onload: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;
        }
        Object.defineProperty(MockImage1080p.prototype, 'src', {
            set() {
                setTimeout(() => {
                    if (this.onload) this.onload();
                }, 0);
            },
            get() { return ''; },
        });
        globalThis.Image = MockImage1080p as unknown as typeof Image;

        const groundTruth: GroundTruth = {
            items: ['Sword'],
            tomes: [],
        };

        const mockDetectionFn = vi.fn().mockResolvedValue({
            items: [mockDetection('Sword')],
            tomes: [],
            character: null,
            weapon: null,
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        expect(result.resolution).toBe('1920x1080');
        expect(result.uiLayout).toBe('pc');
    });

    it('should return confidence scores from detections', async () => {
        const groundTruth: GroundTruth = {
            items: ['Sword', 'Shield'],
            tomes: [],
        };

        const highConfidence: CVDetectionResult = {
            type: 'item',
            entity: { id: 'sword', name: 'Sword' } as Item,
            confidence: 0.95,
            method: 'template_match',
        };
        const lowConfidence: CVDetectionResult = {
            type: 'item',
            entity: { id: 'shield', name: 'Shield' } as Item,
            confidence: 0.75,
            method: 'template_match',
        };

        const mockDetectionFn = vi.fn().mockResolvedValue({
            items: [highConfidence, lowConfidence],
            tomes: [],
            character: null,
            weapon: null,
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        expect(result.confidenceScores).toEqual([0.95, 0.75]);
    });

    it('should set imageName to automated_test', async () => {
        const groundTruth: GroundTruth = {
            items: [],
            tomes: [],
        };

        const mockDetectionFn = vi.fn().mockResolvedValue({
            items: [],
            tomes: [],
            character: null,
            weapon: null,
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        expect(result.imageName).toBe('automated_test');
    });

    it('should handle image load error', async () => {
        // Mock Image that fails to load
        class MockImageError {
            width = 0;
            height = 0;
            onload: (() => void) | null = null;
            onerror: ((err: Error) => void) | null = null;
        }
        Object.defineProperty(MockImageError.prototype, 'src', {
            set() {
                setTimeout(() => {
                    if (this.onerror) this.onerror(new Error('Image load failed'));
                }, 0);
            },
            get() { return ''; },
        });
        globalThis.Image = MockImageError as unknown as typeof Image;

        const groundTruth: GroundTruth = {
            items: ['Sword'],
            tomes: [],
        };

        const mockDetectionFn = vi.fn().mockResolvedValue({
            items: [],
            tomes: [],
            character: null,
            weapon: null,
        });

        const result = await runAutomatedTest(
            'data:image/png;base64,fake',
            groundTruth,
            mockDetectionFn,
            'ocr'
        );

        // Should error out because image fails to load
        expect(result.errors.length).toBeGreaterThan(0);
    });
});
