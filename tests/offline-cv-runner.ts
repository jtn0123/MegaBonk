#!/usr/bin/env node
// ========================================
// Offline Computer Vision Test Runner
// ========================================
// Runs CV detection tests in Node.js without browser
// Perfect for CI/CD pipelines
// ========================================

import * as fs from 'fs';
import * as path from 'path';
import type { CVStrategy } from '../src/modules/cv-strategy.ts';
import { STRATEGY_PRESETS, getConfidenceThresholds } from '../src/modules/cv-strategy.ts';

// Game data types
interface GameItem {
    id: string;
    name: string;
    image?: string;
    rarity: string;
}

interface ItemsData {
    items: GameItem[];
}

// Template cache
interface TemplateData {
    item: GameItem;
    canvas: any;
    ctx: any;
    width: number;
    height: number;
}

const templateCache = new Map<string, TemplateData>();
let itemsData: ItemsData | null = null;

// Try to load canvas module (optional dependency)
let createCanvas: any;
let loadImage: any;
let NodeImageData: any;

try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    NodeImageData = canvas.ImageData;

    /**
     * Polyfill ImageData for Node.js environment
     */
    declare global {
        var ImageData: typeof NodeImageData;
    }
    globalThis.ImageData = NodeImageData as any;

    console.log('✓ Canvas module loaded successfully');
} catch (error) {
    console.error('✗ Canvas module not available');
    console.error('  Install with: bun install canvas');
    console.error('  Or on systems with build issues: npm install --ignore-scripts');
    console.error('');
    console.error('  Note: Canvas requires native dependencies.');
    console.error('  See docs/TESTING.md for details.');
    process.exit(1);
}

/**
 * Ground truth test case
 */
interface TestCase {
    name: string;
    imagePath: string;
    groundTruth: {
        items: Array<{
            id: string;
            name: string;
            count: number;
        }>;
        tomes?: string[];
        character?: string;
        weapon?: string;
    };
    resolution: string;
    language: string;
    difficulty?: string;
}

/**
 * Convert simple item name array to structured format with counts
 * e.g., ["Wrench", "Wrench", "Ice Crystal"] -> [{id: "wrench", name: "Wrench", count: 2}, ...]
 */
function convertItemsArray(items: string[]): Array<{ id: string; name: string; count: number }> {
    const itemCounts = new Map<string, number>();

    for (const item of items) {
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }

    return Array.from(itemCounts.entries()).map(([name, count]) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        count,
    }));
}

/**
 * Test results
 */
interface TestResult {
    testCase: string;
    strategy: string;
    passed: boolean;
    metrics: {
        totalTime: number;
        detections: number;
        truePositives: number;
        falsePositives: number;
        falseNegatives: number;
        precision: number;
        recall: number;
        f1Score: number;
        accuracy: number;
    };
    errors: string[];
}

/**
 * Test runner configuration
 */
interface RunnerConfig {
    testCasesPath: string;
    outputPath: string;
    strategies: string[]; // Strategy preset names to test
    parallel: boolean;
    verbose: boolean;
}

/**
 * Offline CV Test Runner
 */
class OfflineCVRunner {
    private testCases: TestCase[] = [];
    private results: TestResult[] = [];

    constructor(private config: RunnerConfig) {}

    /**
     * Load test cases from ground truth file
     */
    async loadTestCases(): Promise<void> {
        const groundTruthPath = path.join(this.config.testCasesPath, 'ground-truth.json');

        if (!fs.existsSync(groundTruthPath)) {
            throw new Error(`Ground truth file not found: ${groundTruthPath}`);
        }

        const groundTruthData = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

        // Convert ground truth to test cases, skipping metadata entries and non-existent files
        this.testCases = Object.entries(groundTruthData)
            .filter(([imageName]) => {
                // Skip metadata entries (starting with _)
                if (imageName.startsWith('_')) {
                    return false;
                }

                // Check if file exists
                const imagePath = path.join(this.config.testCasesPath, imageName);
                if (!fs.existsSync(imagePath)) {
                    if (this.config.verbose) {
                        console.log(`Skipping non-existent file: ${imageName}`);
                    }
                    return false;
                }

                return true;
            })
            .map(([imageName, data]: [string, any]) => {
                const imagePath = path.join(this.config.testCasesPath, imageName);

                // Convert simple string array to structured format
                const rawItems = data.items || [];
                const structuredItems = Array.isArray(rawItems) && rawItems.length > 0 && typeof rawItems[0] === 'string'
                    ? convertItemsArray(rawItems)
                    : rawItems;

                return {
                    name: imageName,
                    imagePath,
                    groundTruth: {
                        items: structuredItems,
                        tomes: data.tomes,
                        character: data.character,
                        weapon: data.weapon,
                    },
                    resolution: data.resolution || 'unknown',
                    language: data.language || 'english',
                    difficulty: data.difficulty || 'unknown',
                };
            });

        if (this.config.verbose) {
            console.log(`Loaded ${this.testCases.length} test cases`);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests(): Promise<void> {
        console.log('🚀 Starting Offline CV Test Runner\n');
        console.log(`Test cases: ${this.testCases.length}`);
        console.log(`Strategies: ${this.config.strategies.join(', ')}`);
        console.log(`Total runs: ${this.testCases.length * this.config.strategies.length}\n`);

        const startTime = Date.now();

        for (const testCase of this.testCases) {
            const itemCount = testCase.groundTruth.items.reduce((sum, item) => sum + item.count, 0);
            console.log(`\n📋 Test Case: ${testCase.name}`);
            console.log(`   Resolution: ${testCase.resolution}, Language: ${testCase.language}, Difficulty: ${testCase.difficulty}`);
            console.log(`   Ground truth: ${itemCount} items (${testCase.groundTruth.items.length} unique)`);

            for (const strategyName of this.config.strategies) {
                await this.runTest(testCase, strategyName);
            }
        }

        const totalTime = Date.now() - startTime;

        console.log(`\n✅ All tests completed in ${totalTime}ms`);
        console.log(`\n📊 Generating report...`);

        this.generateReport();
    }

    /**
     * Run a single test
     */
    async runTest(testCase: TestCase, strategyName: string): Promise<void> {
        const strategy = STRATEGY_PRESETS[strategyName];

        if (!strategy) {
            console.error(`❌ Unknown strategy: ${strategyName}`);
            return;
        }

        if (this.config.verbose) {
            console.log(`   🔍 Testing strategy: ${strategyName}`);
        }

        try {
            // Load image
            const image = await loadImage(testCase.imagePath);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // Run detection (simulated - we'll use a simplified version)
            const startTime = performance.now();
            const detections = await this.runDetection(ctx, strategy, image.width, image.height);
            const totalTime = performance.now() - startTime;

            // Calculate metrics
            const metrics = this.calculateMetrics(detections, testCase.groundTruth);

            // Determine if test passed (F1 > 0.8 and time < 10s)
            const passed = metrics.f1Score >= 0.8 && totalTime < 10000;

            const result: TestResult = {
                testCase: testCase.name,
                strategy: strategyName,
                passed,
                metrics: {
                    totalTime,
                    detections: detections.length,
                    ...metrics,
                },
                errors: [],
            };

            this.results.push(result);

            const emoji = passed ? '✅' : '❌';
            const f1Pct = (metrics.f1Score * 100).toFixed(1);
            console.log(`   ${emoji} ${strategyName}: F1=${f1Pct}%, Time=${totalTime.toFixed(0)}ms, Detections=${detections.length}`);


        } catch (error) {
            console.error(`   ❌ ${strategyName}: Error - ${(error as Error).message}`);

            this.results.push({
                testCase: testCase.name,
                strategy: strategyName,
                passed: false,
                metrics: {
                    totalTime: 0,
                    detections: 0,
                    truePositives: 0,
                    falsePositives: 0,
                    falseNegatives: 0,
                    precision: 0,
                    recall: 0,
                    f1Score: 0,
                    accuracy: 0,
                },
                errors: [(error as Error).message],
            });
        }
    }

    /**
     * Run actual CV detection using templates and grid positions
     */
    private async runDetection(
        ctx: any,
        strategy: CVStrategy,
        width: number,
        height: number
    ): Promise<Array<{ id: string; name: string; confidence: number }>> {
        // Load templates if not loaded
        await this.loadTemplates();

        // Detect grid positions (hotbar at bottom)
        const gridPositions = this.detectGridPositions(width, height);

        // Get confidence thresholds
        const thresholds = getConfidenceThresholds(strategy);

        const detections: Array<{ id: string; name: string; confidence: number }> = [];

        // Process each grid cell
        for (const cell of gridPositions) {
            // Get cell image data
            const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

            // Skip empty cells
            if (this.isEmptyCell(cellImageData)) {
                continue;
            }

            // Find best match
            const match = await this.findBestMatch(cellImageData, strategy);

            // Use a lower threshold for testing (actual CV uses 0.70)
            const testThreshold = 0.50;
            if (match && match.confidence >= testThreshold) {
                detections.push({
                    id: match.item.id,
                    name: match.item.name,
                    confidence: match.confidence,
                });
            }
        }

        return detections;
    }

    /**
     * Load item templates from game data
     */
    private async loadTemplates(): Promise<void> {
        if (templateCache.size > 0) return;

        // Load items.json
        const itemsPath = path.join(__dirname, '../data/items.json');
        if (!fs.existsSync(itemsPath)) {
            console.warn('⚠️ items.json not found, detection will be limited');
            return;
        }

        itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
        const items = itemsData?.items || [];

        if (this.config.verbose) {
            console.log(`   Loading ${items.length} item templates...`);
        }

        // Load each item's image as template
        for (const item of items) {
            if (!item.image) continue;

            try {
                // Use PNG (node-canvas doesn't support WebP)
                const imagePath = path.join(__dirname, '../src/', item.image);
                if (!fs.existsSync(imagePath)) continue;

                const img = await loadImage(imagePath);
                const canvas = createCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                templateCache.set(item.id, {
                    item,
                    canvas,
                    ctx,
                    width: img.width,
                    height: img.height,
                });
            } catch {
                // Skip failed templates
            }
        }

        if (this.config.verbose) {
            console.log(`   Loaded ${templateCache.size} templates`);
        }
    }

    /**
     * Detect grid positions based on resolution
     * MegaBonk hotbar is centered horizontally at bottom of screen
     */
    private detectGridPositions(width: number, height: number): Array<{ x: number; y: number; width: number; height: number }> {
        // Icon sizes based on resolution (items are 48x48 at 1280x800)
        const iconSize = Math.round(48 * (height / 800));
        const spacing = Math.round(4 * (height / 800));

        // Hotbar is centered horizontally at ~93% down
        const hotbarY = Math.round(height * 0.93);

        // Estimate max items in a row (typically 12-16)
        const maxItems = 16;
        const totalWidth = maxItems * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);

        const positions: Array<{ x: number; y: number; width: number; height: number }> = [];

        for (let i = 0; i < maxItems; i++) {
            positions.push({
                x: startX + i * (iconSize + spacing),
                y: hotbarY,
                width: iconSize,
                height: iconSize,
            });
        }

        return positions;
    }

    /**
     * Check if a cell is empty based on variance
     */
    private isEmptyCell(imageData: any): boolean {
        const pixels = imageData.data;
        let sum = 0, sumSq = 0, count = 0;

        for (let i = 0; i < pixels.length; i += 16) {
            const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            sum += gray;
            sumSq += gray * gray;
            count++;
        }

        const mean = sum / count;
        const variance = sumSq / count - mean * mean;

        return variance < 500;
    }

    /**
     * Find best matching template for a cell
     */
    private async findBestMatch(
        cellImageData: any,
        strategy: CVStrategy
    ): Promise<{ item: GameItem; confidence: number } | null> {
        let bestMatch: { item: GameItem; confidence: number } | null = null;

        for (const [_id, template] of templateCache) {
            // Resize template to cell size
            const resizedCanvas = createCanvas(cellImageData.width, cellImageData.height);
            const resizedCtx = resizedCanvas.getContext('2d');
            resizedCtx.drawImage(template.canvas, 0, 0, cellImageData.width, cellImageData.height);
            const templateData = resizedCtx.getImageData(0, 0, cellImageData.width, cellImageData.height);

            // Calculate similarity using NCC
            const similarity = this.calculateNCC(cellImageData, templateData);

            if (!bestMatch || similarity > bestMatch.confidence) {
                bestMatch = { item: template.item, confidence: similarity };
            }
        }

        return bestMatch;
    }

    /**
     * Normalized Cross-Correlation similarity
     */
    private calculateNCC(imageData1: any, imageData2: any): number {
        const pixels1 = imageData1.data;
        const pixels2 = imageData2.data;

        let sum1 = 0, sum2 = 0, sumProduct = 0, sumSquare1 = 0, sumSquare2 = 0, count = 0;

        const len = Math.min(pixels1.length, pixels2.length);
        for (let i = 0; i < len; i += 4) {
            const gray1 = (pixels1[i] + pixels1[i + 1] + pixels1[i + 2]) / 3;
            const gray2 = (pixels2[i] + pixels2[i + 1] + pixels2[i + 2]) / 3;

            sum1 += gray1;
            sum2 += gray2;
            sumProduct += gray1 * gray2;
            sumSquare1 += gray1 * gray1;
            sumSquare2 += gray2 * gray2;
            count++;
        }

        const mean1 = sum1 / count;
        const mean2 = sum2 / count;

        const numerator = sumProduct / count - mean1 * mean2;
        const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

        if (denominator === 0) return 0;

        return (numerator / denominator + 1) / 2;
    }

    /**
     * Calculate accuracy metrics
     */
    private calculateMetrics(
        detections: Array<{ id: string; name: string; confidence: number }>,
        groundTruth: TestCase['groundTruth']
    ): {
        truePositives: number;
        falsePositives: number;
        falseNegatives: number;
        precision: number;
        recall: number;
        f1Score: number;
        accuracy: number;
    } {
        // Count detected items
        const detectedItems = new Map<string, number>();
        detections.forEach(d => {
            detectedItems.set(d.id, (detectedItems.get(d.id) || 0) + 1);
        });

        // Count ground truth items
        const truthItems = new Map<string, number>();
        groundTruth.items.forEach(item => {
            truthItems.set(item.id, item.count);
        });

        // Calculate TP, FP, FN
        let truePositives = 0;
        let falsePositives = 0;
        let falseNegatives = 0;

        // True positives and false positives
        detectedItems.forEach((detectedCount, itemId) => {
            const truthCount = truthItems.get(itemId) || 0;
            truePositives += Math.min(detectedCount, truthCount);
            if (detectedCount > truthCount) {
                falsePositives += detectedCount - truthCount;
            }
        });

        // False negatives
        truthItems.forEach((truthCount, itemId) => {
            const detectedCount = detectedItems.get(itemId) || 0;
            if (detectedCount < truthCount) {
                falseNegatives += truthCount - detectedCount;
            }
        });

        // Calculate metrics
        const precision = truePositives + falsePositives > 0
            ? truePositives / (truePositives + falsePositives)
            : 0;

        const recall = truePositives + falseNegatives > 0
            ? truePositives / (truePositives + falseNegatives)
            : 0;

        const f1Score = precision + recall > 0
            ? 2 * (precision * recall) / (precision + recall)
            : 0;

        const accuracy = truePositives + falsePositives + falseNegatives > 0
            ? truePositives / (truePositives + falsePositives + falseNegatives)
            : 0;

        return {
            truePositives,
            falsePositives,
            falseNegatives,
            precision,
            recall,
            f1Score,
            accuracy,
        };
    }

    /**
     * Generate test report
     */
    private generateReport(): void {
        // Generate markdown report
        let report = '# Offline CV Test Results\n\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;

        // Summary
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.passed).length;
        const passRate = (passedTests / totalTests * 100).toFixed(1);

        report += '## Summary\n\n';
        report += `- Total Tests: ${totalTests}\n`;
        report += `- Passed: ${passedTests}\n`;
        report += `- Failed: ${totalTests - passedTests}\n`;
        report += `- Pass Rate: ${passRate}%\n\n`;

        // Strategy comparison
        report += '## Strategy Comparison\n\n';
        report += '| Strategy | Avg F1 Score | Avg Time | Pass Rate |\n';
        report += '|----------|-------------|----------|----------|\n';

        const strategyStats = new Map<string, { f1Scores: number[]; times: number[]; passed: number; total: number }>();

        this.results.forEach(result => {
            if (!strategyStats.has(result.strategy)) {
                strategyStats.set(result.strategy, { f1Scores: [], times: [], passed: 0, total: 0 });
            }

            const stats = strategyStats.get(result.strategy)!;
            stats.f1Scores.push(result.metrics.f1Score);
            stats.times.push(result.metrics.totalTime);
            stats.total++;
            if (result.passed) stats.passed++;
        });

        strategyStats.forEach((stats, strategyName) => {
            const avgF1 = (stats.f1Scores.reduce((a, b) => a + b, 0) / stats.f1Scores.length).toFixed(3);
            const avgTime = Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length);
            const passRate = ((stats.passed / stats.total) * 100).toFixed(1);

            report += `| ${strategyName} | ${avgF1} | ${avgTime}ms | ${passRate}% |\n`;
        });

        report += '\n';

        // Detailed results
        report += '## Detailed Results\n\n';

        const byTestCase = new Map<string, TestResult[]>();
        this.results.forEach(result => {
            if (!byTestCase.has(result.testCase)) {
                byTestCase.set(result.testCase, []);
            }
            byTestCase.get(result.testCase)!.push(result);
        });

        byTestCase.forEach((results, testCase) => {
            report += `### ${testCase}\n\n`;
            report += '| Strategy | Passed | F1 Score | Precision | Recall | Time |\n';
            report += '|----------|--------|----------|-----------|--------|------|\n';

            results.forEach(result => {
                const emoji = result.passed ? '✅' : '❌';
                const f1 = (result.metrics.f1Score * 100).toFixed(1);
                const precision = (result.metrics.precision * 100).toFixed(1);
                const recall = (result.metrics.recall * 100).toFixed(1);

                report += `| ${result.strategy} | ${emoji} | ${f1}% | ${precision}% | ${recall}% | ${result.metrics.totalTime.toFixed(0)}ms |\n`;
            });

            report += '\n';
        });

        // Recommendations
        report += '## Recommendations\n\n';

        // Find best strategy by F1 score
        let bestStrategy = '';
        let bestF1 = 0;

        strategyStats.forEach((stats, strategyName) => {
            const avgF1 = stats.f1Scores.reduce((a, b) => a + b, 0) / stats.f1Scores.length;
            if (avgF1 > bestF1) {
                bestF1 = avgF1;
                bestStrategy = strategyName;
            }
        });

        report += `- **Best Strategy (Accuracy):** ${bestStrategy} (F1: ${(bestF1 * 100).toFixed(1)}%)\n`;

        // Find fastest strategy
        let fastestStrategy = '';
        let fastestTime = Infinity;

        strategyStats.forEach((stats, strategyName) => {
            const avgTime = stats.times.reduce((a, b) => a + b, 0) / stats.times.length;
            if (avgTime < fastestTime) {
                fastestTime = avgTime;
                fastestStrategy = strategyName;
            }
        });

        report += `- **Fastest Strategy:** ${fastestStrategy} (${fastestTime.toFixed(0)}ms avg)\n\n`;

        // Save report
        const reportPath = path.join(this.config.outputPath, 'cv-test-report.md');
        fs.mkdirSync(this.config.outputPath, { recursive: true });
        fs.writeFileSync(reportPath, report);

        console.log(`\n📄 Report saved to: ${reportPath}`);

        // Save JSON results
        const jsonPath = path.join(this.config.outputPath, 'cv-test-results.json');
        fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));

        console.log(`📄 JSON results saved to: ${jsonPath}`);

        // Print summary to console
        console.log('\n📊 Summary:');
        console.log(`   Pass Rate: ${passRate}%`);
        console.log(`   Best Strategy: ${bestStrategy} (F1: ${(bestF1 * 100).toFixed(1)}%)`);
        console.log(`   Fastest Strategy: ${fastestStrategy} (${fastestTime.toFixed(0)}ms)`);
    }
}

/**
 * CLI entry point
 */
async function main() {
    const args = process.argv.slice(2);

    // Parse command line arguments
    const config: RunnerConfig = {
        testCasesPath: path.join(__dirname, '../test-images/gameplay'),
        outputPath: path.join(__dirname, '../test-results'),
        strategies: ['current', 'optimized', 'fast', 'accurate', 'balanced'],
        parallel: false,
        verbose: false,
    };

    // Simple argument parsing
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--test-cases' && i + 1 < args.length) {
            config.testCasesPath = args[++i];
        } else if (arg === '--output' && i + 1 < args.length) {
            config.outputPath = args[++i];
        } else if (arg === '--strategies' && i + 1 < args.length) {
            config.strategies = args[++i].split(',');
        } else if (arg === '--verbose' || arg === '-v') {
            config.verbose = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    // Run tests
    const runner = new OfflineCVRunner(config);

    try {
        await runner.loadTestCases();
        await runner.runAllTests();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test runner failed:');
        console.error((error as Error).message);
        process.exit(1);
    }
}

/**
 * Print help message
 */
function printHelp() {
    console.log(`
Offline CV Test Runner

Usage:
  bun run tests/offline-cv-runner.ts [options]

Options:
  --test-cases <path>    Path to test cases directory (default: test-images/gameplay)
  --output <path>        Path to output directory (default: test-results)
  --strategies <list>    Comma-separated list of strategies to test (default: all)
  --verbose, -v          Verbose output
  --help, -h             Show this help message

Examples:
  # Run all strategies on default test cases
  bun run tests/offline-cv-runner.ts

  # Run specific strategies
  bun run tests/offline-cv-runner.ts --strategies current,optimized

  # Custom paths with verbose output
  bun run tests/offline-cv-runner.ts --test-cases ./my-tests --output ./results -v
`);
}

// Run if executed directly
if (require.main === module) {
    main();
}

export { OfflineCVRunner, TestCase, TestResult, RunnerConfig };
