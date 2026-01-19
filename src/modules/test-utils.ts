// ========================================
// MegaBonk Test Utilities Module
// ========================================
// Utilities for testing image recognition accuracy
// ========================================

import type { DetectionResult } from './ocr.ts';
import type { CVDetectionResult } from './computer-vision.ts';
import type { Character, Weapon } from '../types/index.ts';
import { logger } from './logger.ts';

/** Detection function result type for automated testing */
export interface DetectionFnResult {
    items: DetectionResult[] | CVDetectionResult[];
    tomes: DetectionResult[] | CVDetectionResult[];
    character: Character | null;
    weapon: Weapon | null;
}

/** Detection result for comparison (with name identifier) */
interface ComparisonDetectionResult {
    items: (DetectionResult | CVDetectionResult)[];
    name: string;
}

// Test result structure
export interface TestResult {
    imageName: string;
    resolution: string;
    uiLayout: 'pc' | 'steam_deck' | 'unknown';
    detectionMode: 'manual' | 'ocr' | 'hybrid';
    expectedItems: string[];
    detectedItems: string[];
    accuracy: number;
    precision: number;
    recall: number;
    confidenceScores: number[];
    processingTime: number;
    errors: string[];
}

// Ground truth for validation
export interface GroundTruth {
    items: string[];
    tomes: string[];
    character?: string;
    weapon?: string;
}

/**
 * Calculate detection accuracy metrics
 */
export function calculateAccuracyMetrics(
    detected: DetectionResult[] | CVDetectionResult[],
    groundTruth: string[]
): {
    accuracy: number;
    precision: number;
    recall: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
} {
    const detectedNames = detected.map(d => d.entity.name.toLowerCase());
    const truthNames = groundTruth.map(name => name.toLowerCase());

    // True Positives: Detected and in ground truth
    const truePositives = detectedNames.filter(name => truthNames.includes(name)).length;

    // False Positives: Detected but not in ground truth
    const falsePositives = detectedNames.filter(name => !truthNames.includes(name)).length;

    // False Negatives: In ground truth but not detected
    const falseNegatives = truthNames.filter(name => !detectedNames.includes(name)).length;

    // Accuracy: (TP) / (TP + FP + FN)
    const total = truePositives + falsePositives + falseNegatives;
    const accuracy = total > 0 ? truePositives / total : 0;

    // Precision: TP / (TP + FP) - Of what we detected, how much was correct?
    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;

    // Recall: TP / (TP + FN) - Of what should be detected, how much did we find?
    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;

    return {
        accuracy,
        precision,
        recall,
        truePositives,
        falsePositives,
        falseNegatives,
    };
}

/**
 * Calculate F1 score (harmonic mean of precision and recall)
 */
export function calculateF1Score(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return (2 * precision * recall) / (precision + recall);
}

/**
 * Detect image resolution category
 */
export function detectResolution(
    width: number,
    height: number
): {
    category: '720p' | '1080p' | '1440p' | '4K' | 'steam_deck' | 'custom';
    width: number;
    height: number;
} {
    // Steam Deck: 1280x800
    if (width === 1280 && height === 800) {
        return { category: 'steam_deck', width, height };
    }

    // 720p: 1280x720
    if (Math.abs(width - 1280) < 50 && Math.abs(height - 720) < 50) {
        return { category: '720p', width, height };
    }

    // 1080p: 1920x1080
    if (Math.abs(width - 1920) < 50 && Math.abs(height - 1080) < 50) {
        return { category: '1080p', width, height };
    }

    // 1440p: 2560x1440
    if (Math.abs(width - 2560) < 50 && Math.abs(height - 1440) < 50) {
        return { category: '1440p', width, height };
    }

    // 4K: 3840x2160
    if (Math.abs(width - 3840) < 50 && Math.abs(height - 2160) < 50) {
        return { category: '4K', width, height };
    }

    return { category: 'custom', width, height };
}

/**
 * Detect UI layout type based on resolution and aspect ratio
 */
export function detectUILayout(width: number, height: number): 'pc' | 'steam_deck' | 'unknown' {
    const aspectRatio = width / height;

    // Steam Deck: 16:10 aspect ratio (1.6)
    if (Math.abs(aspectRatio - 1.6) < 0.1) {
        return 'steam_deck';
    }

    // PC: 16:9 aspect ratio (1.777...)
    if (Math.abs(aspectRatio - 1.7777) < 0.1) {
        return 'pc';
    }

    return 'unknown';
}

/**
 * Generate test report
 */
export function generateTestReport(results: TestResult[]): string {
    let report = '# MegaBonk Image Recognition Test Report\n\n';
    report += `**Total Tests:** ${results.length}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Overall statistics
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
    const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

    report += '## Overall Performance\n\n';
    report += `- **Average Accuracy:** ${(avgAccuracy * 100).toFixed(2)}%\n`;
    report += `- **Average Precision:** ${(avgPrecision * 100).toFixed(2)}%\n`;
    report += `- **Average Recall:** ${(avgRecall * 100).toFixed(2)}%\n`;
    report += `- **Average Processing Time:** ${avgProcessingTime.toFixed(2)}ms\n\n`;

    // By resolution
    const byResolution = groupBy(results, r => r.resolution);
    report += '## Performance by Resolution\n\n';
    for (const [resolution, resResults] of Object.entries(byResolution)) {
        const resAvgAccuracy = resResults.reduce((sum, r) => sum + r.accuracy, 0) / resResults.length;
        report += `- **${resolution}:** ${(resAvgAccuracy * 100).toFixed(2)}% accuracy (${resResults.length} tests)\n`;
    }
    report += '\n';

    // By UI layout
    const byLayout = groupBy(results, r => r.uiLayout);
    report += '## Performance by UI Layout\n\n';
    for (const [layout, layoutResults] of Object.entries(byLayout)) {
        const layoutAvgAccuracy = layoutResults.reduce((sum, r) => sum + r.accuracy, 0) / layoutResults.length;
        report += `- **${layout}:** ${(layoutAvgAccuracy * 100).toFixed(2)}% accuracy (${layoutResults.length} tests)\n`;
    }
    report += '\n';

    // By detection mode
    const byMode = groupBy(results, r => r.detectionMode);
    report += '## Performance by Detection Mode\n\n';
    for (const [mode, modeResults] of Object.entries(byMode)) {
        const modeAvgAccuracy = modeResults.reduce((sum, r) => sum + r.accuracy, 0) / modeResults.length;
        report += `- **${mode}:** ${(modeAvgAccuracy * 100).toFixed(2)}% accuracy (${modeResults.length} tests)\n`;
    }
    report += '\n';

    // Individual test results
    report += '## Individual Test Results\n\n';
    results.forEach((result, i) => {
        report += `### Test ${i + 1}: ${result.imageName}\n\n`;
        report += `- **Resolution:** ${result.resolution}\n`;
        report += `- **UI Layout:** ${result.uiLayout}\n`;
        report += `- **Detection Mode:** ${result.detectionMode}\n`;
        report += `- **Accuracy:** ${(result.accuracy * 100).toFixed(2)}%\n`;
        report += `- **Precision:** ${(result.precision * 100).toFixed(2)}%\n`;
        report += `- **Recall:** ${(result.recall * 100).toFixed(2)}%\n`;
        report += `- **Processing Time:** ${result.processingTime.toFixed(2)}ms\n`;

        if (result.errors.length > 0) {
            report += `- **Errors:** ${result.errors.join(', ')}\n`;
        }

        report += '\n';
    });

    return report;
}

/**
 * Helper to group array by key
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce(
        (groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        },
        {} as Record<string, T[]>
    );
}

/**
 * Load test image URLs (sample screenshots)
 */
export function getTestImageURLs(): {
    name: string;
    url: string;
    type: 'gameplay' | 'pause_menu';
    resolution: string;
    groundTruth: GroundTruth;
}[] {
    return [
        // Note: These are placeholder URLs - replace with actual MegaBonk screenshots
        {
            name: 'pc_1080p_pause_menu',
            url: '/test-images/pc_1080p_pause.png',
            type: 'pause_menu',
            resolution: '1920x1080',
            groundTruth: {
                items: ['Battery', 'Gym Sauce', 'Anvil'],
                tomes: ['Damage Tome', 'Crit Tome'],
                character: 'CL4NK',
                weapon: 'Hammer',
            },
        },
        {
            name: 'steam_deck_pause_menu',
            url: '/test-images/steam_deck_pause.png',
            type: 'pause_menu',
            resolution: '1280x800',
            groundTruth: {
                items: ['Battery', 'Jetpack', 'Ice Cube'],
                tomes: ['Speed Tome'],
                character: 'Monke',
                weapon: 'Sword',
            },
        },
        {
            name: 'pc_1440p_gameplay',
            url: '/test-images/pc_1440p_gameplay.png',
            type: 'gameplay',
            resolution: '2560x1440',
            groundTruth: {
                items: ['Spicy Meatball', 'Big Bonk'],
                tomes: [],
            },
        },
    ];
}

/**
 * Run automated test on image
 */
export async function runAutomatedTest(
    imageDataUrl: string,
    groundTruth: GroundTruth,
    detectionFn: (imageUrl: string) => Promise<DetectionFnResult>,
    detectionMode: 'ocr' | 'hybrid'
): Promise<TestResult> {
    const startTime = performance.now();

    try {
        // Detect resolution
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageDataUrl;
        });

        const resolution = detectResolution(img.width, img.height);
        const uiLayout = detectUILayout(img.width, img.height);

        // Run detection
        const results = await detectionFn(imageDataUrl);

        // Calculate metrics
        const itemMetrics = calculateAccuracyMetrics(results.items, groundTruth.items);

        const processingTime = performance.now() - startTime;

        const detectedItems = results.items.map(d => d.entity.name);
        const confidenceScores = results.items.map(d => d.confidence);

        logger.info({
            operation: 'test.automated_test',
            data: {
                resolution: `${resolution.width}x${resolution.height}`,
                uiLayout,
                detectionMode,
                accuracy: itemMetrics.accuracy,
                processingTime,
            },
        });

        return {
            imageName: 'automated_test',
            resolution: `${resolution.width}x${resolution.height}`,
            uiLayout,
            detectionMode,
            expectedItems: groundTruth.items,
            detectedItems,
            accuracy: itemMetrics.accuracy,
            precision: itemMetrics.precision,
            recall: itemMetrics.recall,
            confidenceScores,
            processingTime,
            errors: [],
        };
    } catch (error) {
        const processingTime = performance.now() - startTime;

        return {
            imageName: 'automated_test',
            resolution: 'unknown',
            uiLayout: 'unknown',
            detectionMode,
            expectedItems: groundTruth.items,
            detectedItems: [],
            accuracy: 0,
            precision: 0,
            recall: 0,
            confidenceScores: [],
            processingTime,
            errors: [(error as Error).message],
        };
    }
}

/**
 * Compare two detection results
 */
export function compareDetectionResults(
    result1: ComparisonDetectionResult,
    result2: ComparisonDetectionResult
): {
    onlyIn1: string[];
    onlyIn2: string[];
    inBoth: string[];
    agreement: number;
} {
    const items1 = result1.items.map(i => i.entity.name);
    const items2 = result2.items.map(i => i.entity.name);

    const set1 = new Set(items1);
    const set2 = new Set(items2);

    const onlyIn1 = items1.filter(item => !set2.has(item));
    const onlyIn2 = items2.filter(item => !set1.has(item));
    const inBoth = items1.filter(item => set2.has(item));

    const agreement = inBoth.length / Math.max(items1.length, items2.length, 1);

    return {
        onlyIn1,
        onlyIn2,
        inBoth,
        agreement,
    };
}

// ========================================
// Global Assignments
// ========================================
if (typeof window !== 'undefined') {
    window.testUtils = {
        calculateAccuracyMetrics,
        calculateF1Score,
        detectResolution,
        detectUILayout,
        generateTestReport,
        runAutomatedTest,
        compareDetectionResults,
    };
}
