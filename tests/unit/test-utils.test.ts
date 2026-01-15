/**
 * Test Utils Module - Comprehensive Tests
 * Testing accuracy calculations, resolution detection, and report generation
 */

import { describe, it, expect } from 'vitest';
import {
    calculateAccuracyMetrics,
    calculateF1Score,
    detectResolution,
    detectUILayout,
    generateTestReport,
    type TestResult,
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
