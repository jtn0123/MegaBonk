// ========================================
// Image Recognition Debug Module Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setDebugEnabled,
    isDebugEnabled,
    setDebugOptions,
    getDebugOptions,
    log,
    getLogs,
    getLogsByCategory,
    getLogsByLevel,
    clearLogs,
    exportLogs,
    recordDetection,
    recordCacheAccess,
    getStats,
    resetStats,
    validateDetectionResults,
    analyzeRegionColors,
} from '../../src/modules/image-recognition-debug';
import type { DebugOverlayOptions, ValidationTestCase } from '../../src/types/computer-vision';
import {
    createMockImageData,
    createMockDetectionResults,
    VALIDATION_TEST_CASES,
    getColorTestCases,
} from '../fixtures/cv-test-fixtures';

describe('Image Recognition Debug Module', () => {
    beforeEach(() => {
        // Clear logs and reset stats before each test
        clearLogs();
        resetStats();
        setDebugEnabled(false);
    });

    // ========================================
    // Debug Mode Control Tests
    // ========================================

    describe('debug mode control', () => {
        it('should start with debug disabled', () => {
            expect(isDebugEnabled()).toBe(false);
        });

        it('should enable debug mode', () => {
            setDebugEnabled(true);
            expect(isDebugEnabled()).toBe(true);
        });

        it('should disable debug mode', () => {
            setDebugEnabled(true);
            setDebugEnabled(false);
            expect(isDebugEnabled()).toBe(false);
        });

        it('should persist to localStorage', () => {
            // Skip if localStorage not available (Node.js without jsdom)
            if (typeof localStorage === 'undefined') {
                return;
            }

            setDebugEnabled(true);
            expect(localStorage.getItem('megabonk_cv_debug')).toBe('true');

            setDebugEnabled(false);
            expect(localStorage.getItem('megabonk_cv_debug')).toBe('false');
        });
    });

    // ========================================
    // Debug Options Tests
    // ========================================

    describe('debug options', () => {
        it('should return default options', () => {
            const options = getDebugOptions();

            expect(options.showRegionBounds).toBe(true);
            expect(options.showSlotGrid).toBe(true);
            expect(options.showConfidenceLabels).toBe(true);
            expect(options.showDetectionBoxes).toBe(true);
        });

        it('should update options partially', () => {
            setDebugOptions({ showRegionBounds: false });

            const options = getDebugOptions();
            expect(options.showRegionBounds).toBe(false);
            expect(options.showSlotGrid).toBe(true); // Unchanged
        });

        it('should have region colors defined', () => {
            const options = getDebugOptions();

            expect(options.regionColors.items).toBeDefined();
            expect(options.regionColors.weapons).toBeDefined();
            expect(options.regionColors.tomes).toBeDefined();
            expect(options.regionColors.character).toBeDefined();
            expect(options.regionColors.unknown).toBeDefined();
        });
    });

    // ========================================
    // Logging Tests
    // ========================================

    describe('logging', () => {
        it('should record log entries', () => {
            log('test', 'Test message', { data: 123 });

            const logs = getLogs();
            const testLogs = logs.filter((l) => l.category === 'test');
            expect(testLogs.length).toBe(1);
            expect(testLogs[0].category).toBe('test');
            expect(testLogs[0].message).toBe('Test message');
            expect(testLogs[0].data).toEqual({ data: 123 });
        });

        it('should record timestamp', () => {
            const before = Date.now();
            log('test', 'Message');
            const after = Date.now();

            const logs = getLogs();
            const testLog = logs.find((l) => l.category === 'test');
            expect(testLog).toBeDefined();
            expect(testLog!.timestamp).toBeGreaterThanOrEqual(before);
            expect(testLog!.timestamp).toBeLessThanOrEqual(after);
        });

        it('should record log level', () => {
            log('test', 'Debug', undefined, 'debug');
            log('test', 'Info', undefined, 'info');
            log('test', 'Warn', undefined, 'warn');
            log('test', 'Error', undefined, 'error');

            const logs = getLogs();
            // Find our test logs (skip any system logs from beforeEach)
            const testLogs = logs.filter((l) => l.category === 'test');
            expect(testLogs[0].level).toBe('debug');
            expect(testLogs[1].level).toBe('info');
            expect(testLogs[2].level).toBe('warn');
            expect(testLogs[3].level).toBe('error');
        });

        it('should filter logs by category', () => {
            log('cat1', 'Message 1');
            log('cat2', 'Message 2');
            log('cat1', 'Message 3');

            const filtered = getLogsByCategory('cat1');
            expect(filtered.length).toBe(2);
            expect(filtered.every((l) => l.category === 'cat1')).toBe(true);
        });

        it('should filter logs by level', () => {
            log('test', 'Debug', undefined, 'debug');
            log('test', 'Error', undefined, 'error');
            log('test', 'Error 2', undefined, 'error');

            const errors = getLogsByLevel('error');
            expect(errors.length).toBe(2);
        });

        it('should clear logs', () => {
            log('test', 'Message 1');
            log('test', 'Message 2');
            clearLogs();

            // clearLogs adds its own log entry
            const logs = getLogs();
            expect(logs.length).toBe(1);
            expect(logs[0].message).toBe('Logs cleared');
        });

        it('should export logs as JSON', () => {
            log('test', 'Message', { value: 42 });

            const exported = exportLogs();
            const parsed = JSON.parse(exported);

            expect(Array.isArray(parsed)).toBe(true);
            // Find the test log entry (may be after system logs)
            const testLog = parsed.find((l: { category: string }) => l.category === 'test');
            expect(testLog).toBeDefined();
            expect(testLog.category).toBe('test');
        });

        it('should limit log entries', () => {
            // Log more than 500 entries
            for (let i = 0; i < 600; i++) {
                log('test', `Message ${i}`);
            }

            const logs = getLogs();
            expect(logs.length).toBeLessThanOrEqual(500);
        });
    });

    // ========================================
    // Statistics Tests
    // ========================================

    describe('statistics', () => {
        it('should start with zero stats', () => {
            const stats = getStats();

            expect(stats.totalDetections).toBe(0);
            expect(stats.successfulMatches).toBe(0);
            expect(stats.averageConfidence).toBe(0);
            expect(stats.averageProcessingTime).toBe(0);
        });

        it('should record detection', () => {
            const results = createMockDetectionResults(
                ['Big Bonk', 'Ice Cube'],
                ['Hammer'],
                ['HP Tome'],
                'Megachad'
            );

            recordDetection(results as any);

            const stats = getStats();
            expect(stats.totalDetections).toBe(1);
            expect(stats.successfulMatches).toBe(5); // 2 items + 1 weapon + 1 tome + 1 character
        });

        it('should calculate average confidence', () => {
            const results1 = createMockDetectionResults(['Big Bonk'], [], [], undefined);
            const results2 = createMockDetectionResults(['Ice Cube'], [], [], undefined);

            recordDetection(results1 as any);
            recordDetection(results2 as any);

            const stats = getStats();
            expect(stats.averageConfidence).toBeGreaterThan(0);
            expect(stats.averageConfidence).toBeLessThanOrEqual(1);
        });

        it('should record cache access', () => {
            recordCacheAccess(true);
            recordCacheAccess(true);
            recordCacheAccess(false);

            const stats = getStats();
            expect(stats.templateCacheHits).toBe(2);
            expect(stats.templateCacheMisses).toBe(1);
        });

        it('should reset stats', () => {
            recordCacheAccess(true);
            const results = createMockDetectionResults(['Big Bonk'], [], [], undefined);
            recordDetection(results as any);

            resetStats();

            const stats = getStats();
            expect(stats.totalDetections).toBe(0);
            expect(stats.templateCacheHits).toBe(0);
        });
    });

    // ========================================
    // Validation Tests
    // ========================================

    describe('validation', () => {
        it('should pass when all items detected', () => {
            const testCase: ValidationTestCase = {
                name: 'Test',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: ['Big Bonk', 'Ice Cube'],
                expectedWeapons: ['Hammer'],
                expectedTomes: ['HP Tome'],
                expectedCharacter: 'Megachad',
            };

            const results = createMockDetectionResults(
                ['Big Bonk', 'Ice Cube'],
                ['Hammer'],
                ['HP Tome'],
                'Megachad'
            );

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.passed).toBe(true);
            expect(validation.accuracy.overall).toBe(1);
        });

        it('should fail when items missed', () => {
            const testCase: ValidationTestCase = {
                name: 'Test',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: ['Big Bonk', 'Ice Cube', 'Beefy Ring'],
                expectedWeapons: [],
                expectedTomes: [],
            };

            const results = createMockDetectionResults(
                ['Big Bonk'], // Missing Ice Cube and Beefy Ring
                [],
                [],
                undefined
            );

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.missed.items).toContain('Ice Cube');
            expect(validation.missed.items).toContain('Beefy Ring');
            expect(validation.accuracy.items).toBeLessThan(1);
        });

        it('should detect false positives', () => {
            const testCase: ValidationTestCase = {
                name: 'Test',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: ['Big Bonk'],
                expectedWeapons: [],
                expectedTomes: [],
            };

            const results = createMockDetectionResults(
                ['Big Bonk', 'Ice Cube'], // Ice Cube is false positive
                [],
                [],
                undefined
            );

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.falsePositives.items).toContain('Ice Cube');
            expect(validation.passed).toBe(false);
        });

        it('should calculate accuracy correctly', () => {
            const testCase: ValidationTestCase = {
                name: 'Test',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: ['A', 'B', 'C', 'D'], // 4 expected
                expectedWeapons: [],
                expectedTomes: [],
            };

            const results = createMockDetectionResults(
                ['A', 'B'], // 2 matched
                [],
                [],
                undefined
            );

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.accuracy.items).toBe(0.5); // 2/4
            expect(validation.matched.items.length).toBe(2);
            expect(validation.missed.items.length).toBe(2);
        });

        it('should handle empty expected', () => {
            const testCase: ValidationTestCase = {
                name: 'Empty test',
                resolution: '1080p',
                width: 1920,
                height: 1080,
                expectedItems: [],
                expectedWeapons: [],
                expectedTomes: [],
            };

            const results = createMockDetectionResults([], [], [], undefined);

            const validation = validateDetectionResults(results as any, testCase);

            expect(validation.passed).toBe(true);
            expect(validation.accuracy.overall).toBe(1);
        });
    });

    // ========================================
    // Color Analysis Tests
    // ========================================

    describe('color analysis', () => {
        it('should extract dominant colors from uniform image', () => {
            const imageData = createMockImageData(50, 50, 'uniform', { r: 200, g: 100, b: 50 });
            const region = { x: 0, y: 0, width: 50, height: 50 };

            const analysis = analyzeRegionColors(imageData, region);

            expect(analysis.dominantColors.length).toBeGreaterThan(0);
            expect(analysis.averageColor).toBeDefined();
        });

        it('should calculate brightness correctly', () => {
            const brightImage = createMockImageData(20, 20, 'uniform', { r: 200, g: 200, b: 200 });
            const darkImage = createMockImageData(20, 20, 'uniform', { r: 50, g: 50, b: 50 });
            const region = { x: 0, y: 0, width: 20, height: 20 };

            const brightAnalysis = analyzeRegionColors(brightImage, region);
            const darkAnalysis = analyzeRegionColors(darkImage, region);

            expect(brightAnalysis.brightness).toBeGreaterThan(darkAnalysis.brightness);
        });

        it('should calculate saturation correctly', () => {
            const saturatedImage = createMockImageData(20, 20, 'uniform', { r: 255, g: 0, b: 0 });
            const grayImage = createMockImageData(20, 20, 'uniform', { r: 128, g: 128, b: 128 });
            const region = { x: 0, y: 0, width: 20, height: 20 };

            const saturatedAnalysis = analyzeRegionColors(saturatedImage, region);
            const grayAnalysis = analyzeRegionColors(grayImage, region);

            expect(saturatedAnalysis.saturation).toBeGreaterThan(grayAnalysis.saturation);
        });

        it('should handle region at edge of image', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const region = { x: 80, y: 80, width: 40, height: 40 }; // Extends beyond image

            const analysis = analyzeRegionColors(imageData, region);

            expect(analysis).toBeDefined();
            expect(analysis.dominantColors).toBeDefined();
        });

        it('should handle zero-size region', () => {
            const imageData = createMockImageData(100, 100, 'uniform');
            const region = { x: 50, y: 50, width: 0, height: 0 };

            // Should not throw
            const analysis = analyzeRegionColors(imageData, region);
            expect(analysis).toBeDefined();
        });

        getColorTestCases().forEach((testCase) => {
            it(`should identify ${testCase.name} as dominant`, () => {
                const region = { x: 0, y: 0, width: 10, height: 10 };
                const analysis = analyzeRegionColors(testCase.imageData, region);

                // Check that the dominant color is close to expected
                if (analysis.dominantColors.length > 0) {
                    const dominant = analysis.dominantColors[0].rgb;
                    const expected = testCase.expectedDominant;

                    // Allow some tolerance due to quantization
                    const tolerance = 20;
                    expect(Math.abs(dominant.r - expected.r)).toBeLessThan(tolerance);
                    expect(Math.abs(dominant.g - expected.g)).toBeLessThan(tolerance);
                    expect(Math.abs(dominant.b - expected.b)).toBeLessThan(tolerance);
                }
            });
        });
    });
});
