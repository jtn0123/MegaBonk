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

// ========================================
// Rarity Border Color Detection (ported from real detector)
// ========================================

interface RarityColorDef {
    name: string;
    h: [number, number];
    s: [number, number];
    l: [number, number];
    rgb: { r: [number, number]; g: [number, number]; b: [number, number] };
}

const RARITY_BORDER_COLORS: Record<string, RarityColorDef> = {
    common: {
        name: 'common',
        h: [0, 360],
        s: [0, 25],
        l: [35, 75],
        rgb: { r: [100, 200], g: [100, 200], b: [100, 200] },
    },
    uncommon: {
        name: 'uncommon',
        h: [85, 155],
        s: [30, 100],
        l: [20, 70],
        rgb: { r: [0, 150], g: [100, 255], b: [0, 150] },
    },
    rare: {
        name: 'rare',
        h: [190, 250],
        s: [50, 100],
        l: [35, 70],
        rgb: { r: [0, 150], g: [60, 220], b: [150, 255] },
    },
    epic: {
        name: 'epic',
        h: [260, 320],
        s: [40, 100],
        l: [25, 70],
        rgb: { r: [100, 220], g: [0, 150], b: [150, 255] },
    },
    legendary: {
        name: 'legendary',
        h: [15, 55],
        s: [70, 100],
        l: [40, 80],
        rgb: { r: [200, 255], g: [80, 220], b: [0, 150] },
    },
};

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Check if a color matches a specific rarity border color
 */
function matchesRarityColor(r: number, g: number, b: number, rarity: string): boolean {
    const def = RARITY_BORDER_COLORS[rarity];
    if (!def) return false;

    // Quick RGB range check first
    if (r < def.rgb.r[0] || r > def.rgb.r[1]) return false;
    if (g < def.rgb.g[0] || g > def.rgb.g[1]) return false;
    if (b < def.rgb.b[0] || b > def.rgb.b[1]) return false;

    // HSL check for more accuracy
    const hsl = rgbToHsl(r, g, b);

    // Handle hue wraparound
    let hueMatch = false;
    if (def.h[0] <= def.h[1]) {
        hueMatch = hsl.h >= def.h[0] && hsl.h <= def.h[1];
    } else {
        hueMatch = hsl.h >= def.h[0] || hsl.h <= def.h[1];
    }

    const satMatch = hsl.s >= def.s[0] && hsl.s <= def.s[1];
    const lumMatch = hsl.l >= def.l[0] && hsl.l <= def.l[1];

    return hueMatch && satMatch && lumMatch;
}

/**
 * Detect rarity at a specific pixel
 */
function detectRarityAtPixel(r: number, g: number, b: number): string | null {
    for (const rarity of Object.keys(RARITY_BORDER_COLORS)) {
        if (matchesRarityColor(r, g, b, rarity)) {
            return rarity;
        }
    }
    return null;
}

/**
 * Count rarity border pixels in image data
 */
function countRarityBorderPixels(imageData: any): {
    total: number;
    rarityCount: number;
    colorfulCount: number;
} {
    const pixels = imageData.data;
    let rarityCount = 0;
    let colorfulCount = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;

        // Check if colorful
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (saturation > 40) colorfulCount++;

        // Check specific rarity
        const rarity = detectRarityAtPixel(r, g, b);
        if (rarity) {
            rarityCount++;
        }
    }

    return {
        total: pixels.length / 4,
        rarityCount,
        colorfulCount,
    };
}

/**
 * Calculate color variance for detecting empty cells
 */
function calculateColorVariance(imageData: any): number {
    const pixels = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0;
    let count = 0;

    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i] ?? 0;
        sumG += pixels[i + 1] ?? 0;
        sumB += pixels[i + 2] ?? 0;
        count++;
    }

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;

    let varianceSum = 0;
    for (let i = 0; i < pixels.length; i += 16) {
        const diffR = (pixels[i] ?? 0) - meanR;
        const diffG = (pixels[i + 1] ?? 0) - meanG;
        const diffB = (pixels[i + 2] ?? 0) - meanB;
        varianceSum += diffR * diffR + diffG * diffG + diffB * diffB;
    }

    return varianceSum / count;
}

// ========================================
// Grid Parameters Interface
// ========================================

interface GridParameters {
    startX: number;
    startY: number;
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
    confidence: number;
}

const templateCache = new Map<string, TemplateData>();
const templatesByRarity = new Map<string, TemplateData[]>();
let itemsData: ItemsData | null = null;

// Multi-scale template sizes for better matching across resolutions
// Two scales: 48 for smaller icons, 64 for larger
const TEMPLATE_SCALES = [48, 64];
const DEFAULT_TEMPLATE_SIZE = 64;

// ========================================
// Pipeline Configuration for Ablation Testing
// ========================================

/**
 * Pipeline configuration with toggleable components for ablation testing.
 * Each toggle allows testing impact of individual pipeline stages.
 */
interface PipelineConfig {
    name: string;                         // Config name for reporting

    // Template matching options
    useMultiScale: boolean;               // Use multiple template scales [48, 64] vs just 64

    // Preprocessing options
    useContrastEnhancement: boolean;      // Apply contrast enhancement
    useColorNormalization: boolean;       // Apply color normalization
    useSharpening: boolean;               // Apply image sharpening
    useHistogramEqualization: boolean;    // Apply adaptive histogram equalization

    // Grid detection options
    useDynamicGrid: boolean;              // Use dynamic grid detection vs static fallback
    useResolutionAwareParams: boolean;    // Use resolution-specific grid parameters

    // Filtering options
    useRarityFiltering: boolean;          // Filter templates by detected rarity
    useEmptyCellFilter: boolean;          // Skip empty cells

    // Similarity metrics (at least one must be true)
    metrics: {
        ssim: boolean;                    // Structural similarity
        ncc: boolean;                     // Normalized cross-correlation
        histogram: boolean;               // Color histogram comparison
        edge: boolean;                    // Edge-based similarity
    };

    // Score combination
    useAgreementBonus: boolean;           // Add bonus when metrics agree
}

/**
 * Default pipeline configuration (current best settings)
 */
const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
    name: 'default',
    useMultiScale: true,
    useContrastEnhancement: true,
    useColorNormalization: true,
    useSharpening: false,
    useHistogramEqualization: false,
    useDynamicGrid: true,
    useResolutionAwareParams: true,
    useRarityFiltering: true,
    useEmptyCellFilter: true,
    metrics: {
        ssim: true,
        ncc: true,
        histogram: true,
        edge: false,
    },
    useAgreementBonus: true,
};

/**
 * Generate ablation test configurations by toggling each component off individually
 */
function generateAblationConfigs(): PipelineConfig[] {
    const configs: PipelineConfig[] = [];

    // Baseline with all features on
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'baseline-all-on' });

    // Minimal config (everything off except essentials)
    configs.push({
        name: 'minimal',
        useMultiScale: false,
        useContrastEnhancement: false,
        useColorNormalization: false,
        useSharpening: false,
        useHistogramEqualization: false,
        useDynamicGrid: false,
        useResolutionAwareParams: false,
        useRarityFiltering: false,
        useEmptyCellFilter: false,
        metrics: { ssim: true, ncc: false, histogram: false, edge: false },
        useAgreementBonus: false,
    });

    // Toggle off each component individually
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-multi-scale', useMultiScale: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-contrast', useContrastEnhancement: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-normalize', useColorNormalization: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-dynamic-grid', useDynamicGrid: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-resolution-params', useResolutionAwareParams: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-rarity-filter', useRarityFiltering: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-empty-filter', useEmptyCellFilter: false });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'no-agreement-bonus', useAgreementBonus: false });

    // Test individual metrics
    configs.push({
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'ssim-only',
        metrics: { ssim: true, ncc: false, histogram: false, edge: false },
    });
    configs.push({
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'ncc-only',
        metrics: { ssim: false, ncc: true, histogram: false, edge: false },
    });
    configs.push({
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'histogram-only',
        metrics: { ssim: false, ncc: false, histogram: true, edge: false },
    });
    configs.push({
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'ssim+ncc',
        metrics: { ssim: true, ncc: true, histogram: false, edge: false },
    });
    configs.push({
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'ssim+histogram',
        metrics: { ssim: true, ncc: false, histogram: true, edge: false },
    });

    // Toggle ON additional features
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'with-sharpening', useSharpening: true });
    configs.push({ ...DEFAULT_PIPELINE_CONFIG, name: 'with-histogram-eq', useHistogramEqualization: true });
    configs.push({
        ...DEFAULT_PIPELINE_CONFIG,
        name: 'with-edge-metric',
        metrics: { ssim: true, ncc: true, histogram: true, edge: true },
    });

    return configs;
}

/**
 * Generate quick ablation configs (subset for faster testing)
 */
function generateQuickAblationConfigs(): PipelineConfig[] {
    return [
        { ...DEFAULT_PIPELINE_CONFIG, name: 'baseline-all-on' },
        { ...DEFAULT_PIPELINE_CONFIG, name: 'no-multi-scale', useMultiScale: false },
        { ...DEFAULT_PIPELINE_CONFIG, name: 'no-contrast', useContrastEnhancement: false },
        { ...DEFAULT_PIPELINE_CONFIG, name: 'no-dynamic-grid', useDynamicGrid: false },
        { ...DEFAULT_PIPELINE_CONFIG, name: 'no-rarity-filter', useRarityFiltering: false },
        {
            name: 'minimal',
            useMultiScale: false,
            useContrastEnhancement: false,
            useColorNormalization: false,
            useSharpening: false,
            useHistogramEqualization: false,
            useDynamicGrid: false,
            useResolutionAwareParams: false,
            useRarityFiltering: false,
            useEmptyCellFilter: false,
            metrics: { ssim: true, ncc: false, histogram: false, edge: false },
            useAgreementBonus: false,
        },
    ];
}

// Multi-scale template cache: itemId -> scale -> TemplateData
const multiScaleTemplates = new Map<string, Map<number, TemplateData>>();

// Name-to-ID lookup map (populated from items.json)
// Fixes critical bug: ground truth used hyphens but item IDs use underscores
const itemNameToId = new Map<string, string>();

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
 * Initialize name-to-ID lookup from items.json
 * Must be called before convertItemsArray
 */
function initializeNameToIdLookup(): void {
    if (itemNameToId.size > 0) return; // Already initialized

    const itemsPath = path.join(__dirname, '../data/items.json');
    if (!fs.existsSync(itemsPath)) {
        console.warn('⚠️ items.json not found for name lookup');
        return;
    }

    const data = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    const items = data?.items || [];

    for (const item of items) {
        if (item.name && item.id) {
            // Store both exact name and lowercase for flexible matching
            itemNameToId.set(item.name, item.id);
            itemNameToId.set(item.name.toLowerCase(), item.id);
        }
    }

    console.log(`   ✓ Initialized name-to-ID lookup with ${itemNameToId.size / 2} items`);
}

/**
 * Convert simple item name array to structured format with counts
 * e.g., ["Wrench", "Wrench", "Ice Crystal"] -> [{id: "wrench", name: "Wrench", count: 2}, ...]
 * Uses actual item IDs from items.json instead of generating them
 */
function convertItemsArray(items: string[]): Array<{ id: string; name: string; count: number }> {
    // Ensure lookup is initialized
    initializeNameToIdLookup();

    const itemCounts = new Map<string, number>();

    for (const item of items) {
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }

    return Array.from(itemCounts.entries()).map(([name, count]) => {
        // Look up actual ID from items.json
        let id = itemNameToId.get(name) || itemNameToId.get(name.toLowerCase());

        // Fallback: generate ID with underscores (matching items.json format)
        if (!id) {
            id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            console.warn(`   ⚠️ Unknown item "${name}", using generated ID: ${id}`);
        }

        return { id, name, count };
    });
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
    // Ablation testing options
    ablationMode: boolean;              // Run ablation tests instead of strategy tests
    ablationQuick: boolean;             // Use quick subset of ablation configs
    pipelineConfigs?: PipelineConfig[]; // Custom pipeline configs to test
}

/**
 * Ablation test result (extends TestResult with config info)
 */
interface AblationResult extends TestResult {
    pipelineConfig: string;
}

/**
 * Offline CV Test Runner
 */
class OfflineCVRunner {
    private testCases: TestCase[] = [];
    private results: TestResult[] = [];
    private ablationResults: AblationResult[] = [];
    private currentPipelineConfig: PipelineConfig = DEFAULT_PIPELINE_CONFIG;

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

        // Convert ground truth to test cases, skipping metadata entries, template sources, and non-existent files
        let skippedTemplateSource = 0;
        this.testCases = Object.entries(groundTruthData)
            .filter(([imageName, data]: [string, any]) => {
                // Skip metadata entries (starting with _)
                if (imageName.startsWith('_')) {
                    return false;
                }

                // Skip template_source images - these are for template extraction, not accuracy testing
                // They typically have 75-116 items which overwhelms the detection system
                if (data.difficulty === 'template_source') {
                    skippedTemplateSource++;
                    if (this.config.verbose) {
                        console.log(`Skipping template_source image: ${imageName}`);
                    }
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

        console.log(`Loaded ${this.testCases.length} test cases`);
        if (skippedTemplateSource > 0) {
            console.log(`   (Excluded ${skippedTemplateSource} template_source images from accuracy testing)`);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests(): Promise<void> {
        // Branch to ablation mode if enabled
        if (this.config.ablationMode) {
            await this.runAblationTests();
            return;
        }

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
     * Run ablation tests - systematically toggle pipeline components
     */
    async runAblationTests(): Promise<void> {
        const configs = this.config.pipelineConfigs
            || (this.config.ablationQuick ? generateQuickAblationConfigs() : generateAblationConfigs());

        console.log('🧪 Starting Ablation Test Mode\n');
        console.log(`Test cases: ${this.testCases.length}`);
        console.log(`Pipeline configs: ${configs.length}`);
        console.log(`Total runs: ${this.testCases.length * configs.length}\n`);

        console.log('Configurations to test:');
        for (const cfg of configs) {
            console.log(`   - ${cfg.name}`);
        }
        console.log('');

        const startTime = Date.now();

        for (const pipelineConfig of configs) {
            console.log(`\n═══════════════════════════════════════`);
            console.log(`🔧 Pipeline Config: ${pipelineConfig.name}`);
            console.log(`═══════════════════════════════════════`);
            this.printPipelineConfigSummary(pipelineConfig);

            // Set current pipeline config
            this.currentPipelineConfig = pipelineConfig;

            // Run all test cases with this config
            for (const testCase of this.testCases) {
                const itemCount = testCase.groundTruth.items.reduce((sum, item) => sum + item.count, 0);
                console.log(`\n📋 ${testCase.name}`);
                console.log(`   Ground truth: ${itemCount} items`);

                await this.runAblationTest(testCase, pipelineConfig);
            }
        }

        const totalTime = Date.now() - startTime;

        console.log(`\n\n✅ Ablation tests completed in ${(totalTime / 1000).toFixed(1)}s`);
        console.log(`\n📊 Generating ablation report...`);

        this.generateAblationReport();
    }

    /**
     * Print summary of pipeline config toggles
     */
    private printPipelineConfigSummary(config: PipelineConfig): void {
        const on = '✓';
        const off = '✗';

        console.log(`   Template: multi-scale=${config.useMultiScale ? on : off}`);
        console.log(`   Preprocess: contrast=${config.useContrastEnhancement ? on : off} normalize=${config.useColorNormalization ? on : off} sharpen=${config.useSharpening ? on : off} histEq=${config.useHistogramEqualization ? on : off}`);
        console.log(`   Grid: dynamic=${config.useDynamicGrid ? on : off} resAware=${config.useResolutionAwareParams ? on : off}`);
        console.log(`   Filter: rarity=${config.useRarityFiltering ? on : off} empty=${config.useEmptyCellFilter ? on : off}`);
        console.log(`   Metrics: ssim=${config.metrics.ssim ? on : off} ncc=${config.metrics.ncc ? on : off} hist=${config.metrics.histogram ? on : off} edge=${config.metrics.edge ? on : off}`);
        console.log(`   Bonus: agreement=${config.useAgreementBonus ? on : off}`);
    }

    /**
     * Run a single ablation test
     */
    private async runAblationTest(testCase: TestCase, pipelineConfig: PipelineConfig): Promise<void> {
        try {
            // Load image
            const image = await loadImage(testCase.imagePath);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // Run detection with current pipeline config
            const startTime = performance.now();
            const detections = await this.runDetectionWithConfig(ctx, image.width, image.height, pipelineConfig);
            const totalTime = performance.now() - startTime;

            // Calculate metrics
            const metrics = this.calculateMetrics(detections, testCase.groundTruth);

            // Determine if test passed
            const passed = metrics.f1Score >= 0.8 && totalTime < 10000;

            const result: AblationResult = {
                testCase: testCase.name,
                strategy: 'ablation',
                pipelineConfig: pipelineConfig.name,
                passed,
                metrics: {
                    totalTime,
                    detections: detections.length,
                    ...metrics,
                },
                errors: [],
            };

            this.ablationResults.push(result);

            const emoji = passed ? '✅' : '❌';
            const f1Pct = (metrics.f1Score * 100).toFixed(1);
            console.log(`   ${emoji} F1=${f1Pct}%, P=${(metrics.precision * 100).toFixed(1)}%, R=${(metrics.recall * 100).toFixed(1)}%, Time=${totalTime.toFixed(0)}ms`);

            if (this.config.verbose) {
                this.printDetectionDebug(detections, testCase.groundTruth, metrics);
            }

        } catch (error) {
            console.error(`   ❌ Error: ${(error as Error).message}`);

            this.ablationResults.push({
                testCase: testCase.name,
                strategy: 'ablation',
                pipelineConfig: pipelineConfig.name,
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
     * Run detection with specific pipeline configuration
     * This is the configurable version of runDetection
     */
    private async runDetectionWithConfig(
        ctx: any,
        width: number,
        height: number,
        config: PipelineConfig
    ): Promise<Array<{ id: string; name: string; confidence: number }>> {
        // Load templates if not loaded
        await this.loadTemplates();

        // Grid detection based on config
        let gridPositions: Array<{ x: number; y: number; width: number; height: number }>;

        if (config.useDynamicGrid) {
            // Phase 1: Detect hotbar region
            const hotbarRegion = this.detectHotbarRegion(ctx, width, height);

            // Phase 2: Detect icon edges
            const edges = this.detectIconEdges(ctx, width, hotbarRegion);

            // Phase 3: Infer grid structure
            const grid = this.inferGridFromEdges(edges, hotbarRegion, width);

            if (grid && grid.confidence >= 0.4 && grid.columns >= 3) {
                gridPositions = this.generateGridROIs(grid);
                if (this.config.verbose) {
                    console.log(`      Grid detected: ${grid.columns}x${grid.rows}, conf=${(grid.confidence * 100).toFixed(0)}%`);
                }
            } else {
                // Fall back to static
                gridPositions = config.useResolutionAwareParams
                    ? this.detectGridPositionsStatic(width, height)
                    : this.detectGridPositionsBasic(width, height);
            }
        } else {
            // Static grid only
            gridPositions = config.useResolutionAwareParams
                ? this.detectGridPositionsStatic(width, height)
                : this.detectGridPositionsBasic(width, height);
        }

        const detections: Array<{ id: string; name: string; confidence: number }> = [];
        const CONFIDENCE_THRESHOLD = 0.40;

        // Process each grid cell
        for (const cell of gridPositions) {
            // Bounds check
            if (cell.x < 0 || cell.y < 0 ||
                cell.x + cell.width > width ||
                cell.y + cell.height > height) {
                continue;
            }

            // Get cell image data
            const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

            // Skip empty cells if enabled
            if (config.useEmptyCellFilter && this.isEmptyCell(cellImageData)) {
                continue;
            }

            // Find best match using configured pipeline
            const match = await this.findBestMatchWithConfig(cellImageData, config);

            if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
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
     * Basic static grid detection (no resolution-aware params)
     */
    private detectGridPositionsBasic(width: number, height: number): Array<{ x: number; y: number; width: number; height: number }> {
        const iconSize = 64;
        const spacing = 6;
        const bottomMargin = 30;
        const sideMargin = width * 0.18;
        const maxRows = 2;

        const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
        const rowHeight = iconSize + spacing;

        for (let row = 0; row < maxRows; row++) {
            const rowY = height - bottomMargin - iconSize - row * rowHeight;
            if (rowY < height * 0.70) break;

            const usableWidth = width - sideMargin * 2;
            const maxItemsPerRow = Math.min(15, Math.floor(usableWidth / (iconSize + spacing)));
            const totalWidth = maxItemsPerRow * (iconSize + spacing);
            const startX = Math.round((width - totalWidth) / 2);

            for (let i = 0; i < maxItemsPerRow; i++) {
                positions.push({
                    x: startX + i * (iconSize + spacing),
                    y: rowY,
                    width: iconSize,
                    height: iconSize,
                });
            }
        }

        return positions;
    }

    /**
     * Find best match with configurable pipeline
     */
    private async findBestMatchWithConfig(
        cellImageData: any,
        config: PipelineConfig
    ): Promise<{ item: GameItem; confidence: number; rarity?: string } | null> {
        // Detect rarity if filtering enabled
        let detectedRarity: string | null = null;
        if (config.useRarityFiltering) {
            detectedRarity = this.detectRarityFromBorder(cellImageData);
        }

        // Get candidate templates
        let candidateIds: string[];
        if (detectedRarity && templatesByRarity.has(detectedRarity)) {
            candidateIds = templatesByRarity.get(detectedRarity)!.map(t => t.item.id);
        } else {
            candidateIds = Array.from(templateCache.keys());
        }

        let bestMatch: { item: GameItem; confidence: number; rarity?: string } | null = null;

        // Prepare cell for matching
        const margin = Math.round(cellImageData.width * 0.20);
        const centerWidth = cellImageData.width - margin * 2;
        const centerHeight = cellImageData.height - margin * 2;

        const tempCanvas = createCanvas(cellImageData.width, cellImageData.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(cellImageData, 0, 0);

        // Determine scales to use
        const scales = config.useMultiScale ? TEMPLATE_SCALES : [DEFAULT_TEMPLATE_SIZE];

        // Pre-create cell data at each scale
        const cellDataByScale = new Map<number, any>();
        for (const scale of scales) {
            const cellCanvas = createCanvas(scale, scale);
            const cellCtx = cellCanvas.getContext('2d');
            cellCtx.drawImage(
                tempCanvas,
                margin, margin,
                centerWidth, centerHeight,
                0, 0,
                scale, scale
            );
            cellDataByScale.set(scale, cellCtx.getImageData(0, 0, scale, scale));
        }

        // Try each candidate at each scale
        for (const itemId of candidateIds) {
            const scaleMap = multiScaleTemplates.get(itemId);
            if (!scaleMap) continue;

            for (const scale of scales) {
                const template = scaleMap.get(scale);
                if (!template) continue;

                const cellData = cellDataByScale.get(scale);
                if (!cellData) continue;

                // Extract center region of template
                const tMargin = Math.round(scale * 0.15);
                const tCenterSize = scale - tMargin * 2;

                const templateCenterCanvas = createCanvas(scale, scale);
                const templateCenterCtx = templateCenterCanvas.getContext('2d');
                templateCenterCtx.drawImage(
                    template.canvas,
                    tMargin, tMargin,
                    tCenterSize, tCenterSize,
                    0, 0,
                    scale, scale
                );
                const templateData = templateCenterCtx.getImageData(0, 0, scale, scale);

                // Calculate similarity with configured pipeline
                let similarity = this.calculateSimilarityWithConfig(cellData, templateData, config);

                // Boost confidence if rarity matches
                if (detectedRarity && template.item.rarity === detectedRarity) {
                    similarity *= 1.15;
                }

                similarity = Math.min(0.99, similarity);

                if (!bestMatch || similarity > bestMatch.confidence) {
                    bestMatch = {
                        item: template.item,
                        confidence: similarity,
                        rarity: detectedRarity || undefined
                    };
                }
            }
        }

        return bestMatch;
    }

    /**
     * Calculate similarity with configurable preprocessing and metrics
     */
    private calculateSimilarityWithConfig(imageData1: any, imageData2: any, config: PipelineConfig): number {
        // Apply preprocessing based on config
        let processed1 = imageData1;
        let processed2 = imageData2;

        if (config.useContrastEnhancement) {
            processed1 = this.enhanceContrast(processed1, 1.4);
            processed2 = this.enhanceContrast(processed2, 1.4);
        }

        if (config.useColorNormalization) {
            processed1 = this.normalizeColors(processed1);
            processed2 = this.normalizeColors(processed2);
        }

        if (config.useSharpening) {
            processed1 = this.sharpenImage(processed1, 0.5);
            processed2 = this.sharpenImage(processed2, 0.5);
        }

        if (config.useHistogramEqualization) {
            processed1 = this.adaptiveHistogramEqualization(processed1);
            processed2 = this.adaptiveHistogramEqualization(processed2);
        }

        // Calculate enabled metrics
        const scores: number[] = [];
        const weights: number[] = [];

        if (config.metrics.ssim) {
            scores.push(this.calculateSSIM(processed1, processed2));
            weights.push(0.40);
        }

        if (config.metrics.ncc) {
            scores.push(this.calculateNCC(processed1, processed2));
            weights.push(0.35);
        }

        if (config.metrics.histogram) {
            scores.push(this.calculateHistogramSimilarity(processed1, processed2));
            weights.push(0.25);
        }

        if (config.metrics.edge) {
            scores.push(this.calculateEdgeSimilarity(processed1, processed2));
            weights.push(0.20);
        }

        // Calculate weighted score
        if (scores.length === 0) {
            return 0;
        }

        // Normalize weights
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let weightedScore = 0;
        for (let i = 0; i < scores.length; i++) {
            weightedScore += scores[i] * (weights[i] / totalWeight);
        }

        // Agreement bonus
        if (config.useAgreementBonus) {
            const highScores = scores.filter(s => s > 0.5).length;
            if (highScores >= 2) {
                weightedScore += 0.03;
            }
        }

        return Math.min(0.99, weightedScore);
    }

    /**
     * Generate ablation test report
     */
    private generateAblationReport(): void {
        let report = '# Ablation Test Results\n\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;

        // Group results by pipeline config
        const byConfig = new Map<string, AblationResult[]>();
        for (const result of this.ablationResults) {
            if (!byConfig.has(result.pipelineConfig)) {
                byConfig.set(result.pipelineConfig, []);
            }
            byConfig.get(result.pipelineConfig)!.push(result);
        }

        // Summary table
        report += '## Summary by Configuration\n\n';
        report += '| Config | Avg F1 | Avg Precision | Avg Recall | Avg Time | Δ from Baseline |\n';
        report += '|--------|--------|---------------|------------|----------|----------------|\n';

        // Calculate stats for each config
        const configStats: Array<{
            name: string;
            avgF1: number;
            avgPrecision: number;
            avgRecall: number;
            avgTime: number;
        }> = [];

        for (const [configName, results] of byConfig) {
            const avgF1 = results.reduce((s, r) => s + r.metrics.f1Score, 0) / results.length;
            const avgPrecision = results.reduce((s, r) => s + r.metrics.precision, 0) / results.length;
            const avgRecall = results.reduce((s, r) => s + r.metrics.recall, 0) / results.length;
            const avgTime = results.reduce((s, r) => s + r.metrics.totalTime, 0) / results.length;

            configStats.push({ name: configName, avgF1, avgPrecision, avgRecall, avgTime });
        }

        // Find baseline for delta calculation
        const baseline = configStats.find(s => s.name === 'baseline-all-on');
        const baselineF1 = baseline?.avgF1 || configStats[0]?.avgF1 || 0;

        // Sort by F1 score descending
        configStats.sort((a, b) => b.avgF1 - a.avgF1);

        for (const stats of configStats) {
            const delta = stats.avgF1 - baselineF1;
            const deltaStr = delta >= 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`;
            const isBaseline = stats.name === 'baseline-all-on';

            report += `| ${stats.name} | ${(stats.avgF1 * 100).toFixed(1)}% | ${(stats.avgPrecision * 100).toFixed(1)}% | ${(stats.avgRecall * 100).toFixed(1)}% | ${stats.avgTime.toFixed(0)}ms | ${isBaseline ? '-' : deltaStr} |\n`;
        }

        report += '\n';

        // Recommendations
        report += '## Analysis\n\n';

        const bestConfig = configStats[0];
        const worstConfig = configStats[configStats.length - 1];

        report += `### Best Configuration: ${bestConfig.name}\n`;
        report += `- F1 Score: ${(bestConfig.avgF1 * 100).toFixed(1)}%\n`;
        report += `- Time: ${bestConfig.avgTime.toFixed(0)}ms\n\n`;

        report += `### Worst Configuration: ${worstConfig.name}\n`;
        report += `- F1 Score: ${(worstConfig.avgF1 * 100).toFixed(1)}%\n`;
        report += `- Time: ${worstConfig.avgTime.toFixed(0)}ms\n\n`;

        // Component impact analysis
        report += '### Component Impact Analysis\n\n';
        report += 'Components sorted by impact when disabled (negative = component helps, positive = component hurts):\n\n';

        const impacts: Array<{ component: string; impact: number }> = [];

        for (const stats of configStats) {
            if (stats.name.startsWith('no-')) {
                const component = stats.name.replace('no-', '');
                const impact = stats.avgF1 - baselineF1;
                impacts.push({ component, impact });
            }
        }

        impacts.sort((a, b) => a.impact - b.impact);

        for (const { component, impact } of impacts) {
            const emoji = impact < -0.01 ? '🟢' : impact > 0.01 ? '🔴' : '⚪';
            const impactStr = impact >= 0 ? `+${(impact * 100).toFixed(1)}%` : `${(impact * 100).toFixed(1)}%`;
            report += `${emoji} **${component}**: ${impactStr} (${impact < 0 ? 'helps' : impact > 0 ? 'hurts' : 'neutral'})\n`;
        }

        report += '\n';

        // Detailed results per test case
        report += '## Detailed Results by Test Case\n\n';

        const testCases = [...new Set(this.ablationResults.map(r => r.testCase))];

        for (const testCase of testCases) {
            report += `### ${testCase}\n\n`;
            report += '| Config | F1 | Precision | Recall | Time |\n';
            report += '|--------|-----|-----------|--------|------|\n';

            const results = this.ablationResults
                .filter(r => r.testCase === testCase)
                .sort((a, b) => b.metrics.f1Score - a.metrics.f1Score);

            for (const result of results) {
                report += `| ${result.pipelineConfig} | ${(result.metrics.f1Score * 100).toFixed(1)}% | ${(result.metrics.precision * 100).toFixed(1)}% | ${(result.metrics.recall * 100).toFixed(1)}% | ${result.metrics.totalTime.toFixed(0)}ms |\n`;
            }

            report += '\n';
        }

        // Save report
        const reportPath = path.join(this.config.outputPath, 'ablation-report.md');
        fs.mkdirSync(this.config.outputPath, { recursive: true });
        fs.writeFileSync(reportPath, report);

        console.log(`\n📄 Ablation report saved to: ${reportPath}`);

        // Save JSON results
        const jsonPath = path.join(this.config.outputPath, 'ablation-results.json');
        fs.writeFileSync(jsonPath, JSON.stringify({
            summary: configStats,
            impacts,
            results: this.ablationResults,
        }, null, 2));

        console.log(`📄 JSON results saved to: ${jsonPath}`);

        // Print summary to console
        console.log('\n📊 Ablation Summary:');
        console.log(`   Best: ${bestConfig.name} (F1: ${(bestConfig.avgF1 * 100).toFixed(1)}%)`);
        console.log(`   Worst: ${worstConfig.name} (F1: ${(worstConfig.avgF1 * 100).toFixed(1)}%)`);

        if (impacts.length > 0) {
            console.log('\n   Component Impact (when disabled):');
            for (const { component, impact } of impacts.slice(0, 5)) {
                const emoji = impact < -0.01 ? '🟢' : impact > 0.01 ? '🔴' : '⚪';
                const verb = impact < 0 ? 'helps' : impact > 0 ? 'hurts' : 'neutral';
                console.log(`   ${emoji} ${component}: ${verb} (${(impact * 100).toFixed(1)}%)`);
            }
        }
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
            const detections = await this.runDetection(ctx, strategy, image.width, image.height, strategyName);
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

            // Debug logging when verbose
            if (this.config.verbose) {
                this.printDetectionDebug(detections, testCase.groundTruth, metrics);
            }


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
     * Run actual CV detection using templates and dynamic grid detection
     * Ported from real browser detector for consistency
     */
    private async runDetection(
        ctx: any,
        strategy: CVStrategy,
        width: number,
        height: number,
        strategyName: string = 'current'
    ): Promise<Array<{ id: string; name: string; confidence: number }>> {
        // Load templates if not loaded
        await this.loadTemplates();

        // Phase 1: Detect hotbar region using rarity border analysis
        const hotbarRegion = this.detectHotbarRegion(ctx, width, height);

        // Phase 2: Detect icon edges within the hotbar
        const edges = this.detectIconEdges(ctx, width, hotbarRegion);

        // Phase 3: Infer grid structure from edges
        const grid = this.inferGridFromEdges(edges, hotbarRegion, width);

        // Generate grid positions from detected grid or fall back to static
        let gridPositions: Array<{ x: number; y: number; width: number; height: number }>;

        if (grid && grid.confidence >= 0.4 && grid.columns >= 3) {
            // Use dynamically detected grid
            gridPositions = this.generateGridROIs(grid);
            if (this.config.verbose) {
                console.log(`   Grid detected: ${grid.columns}x${grid.rows}, confidence: ${(grid.confidence * 100).toFixed(1)}%`);
            }
        } else {
            // Fall back to static grid detection
            gridPositions = this.detectGridPositionsStatic(width, height);
            if (this.config.verbose) {
                console.log(`   Using static grid fallback (${gridPositions.length} cells)`);
            }
        }

        const detections: Array<{ id: string; name: string; confidence: number }> = [];

        // Note: Offline runner produces lower similarity scores than browser version
        // because it lacks multi-scale templates and training data optimizations.
        // Use 0.40 threshold to improve recall while accepting some false positives.
        const CONFIDENCE_THRESHOLD = 0.40;

        // Process each grid cell
        for (const cell of gridPositions) {
            // Bounds check
            if (cell.x < 0 || cell.y < 0 ||
                cell.x + cell.width > width ||
                cell.y + cell.height > height) {
                continue;
            }

            // Get cell image data
            const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

            // Skip empty cells
            if (this.isEmptyCell(cellImageData)) {
                continue;
            }

            // Find best match
            const match = await this.findBestMatch(cellImageData, strategy);

            if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
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
     * Detect hotbar region using rarity border analysis (ported from real detector)
     */
    private detectHotbarRegion(
        ctx: any,
        width: number,
        height: number
    ): { topY: number; bottomY: number; confidence: number } {
        // Scan bottom 35% of screen
        const scanStartY = Math.floor(height * 0.65);
        const scanEndY = height - 5;

        // Sample center 70% of width
        const sampleStartX = Math.floor(width * 0.15);
        const sampleWidth = Math.floor(width * 0.7);

        // Analyze horizontal strips
        const stripHeight = 2;
        const strips: Array<{
            y: number;
            rarityRatio: number;
            colorfulRatio: number;
            variance: number;
        }> = [];

        for (let y = scanStartY; y < scanEndY; y += stripHeight) {
            const imageData = ctx.getImageData(sampleStartX, y, sampleWidth, stripHeight);
            const stats = countRarityBorderPixels(imageData);
            const variance = calculateColorVariance(imageData);

            strips.push({
                y,
                rarityRatio: stats.rarityCount / stats.total,
                colorfulRatio: stats.colorfulCount / stats.total,
                variance,
            });
        }

        // Find best hotbar band using sliding window
        const windowSize = 35;
        let bestScore = 0;
        let bestBandStart = scanStartY;
        let bestBandEnd = scanEndY;

        for (let i = 0; i < strips.length - windowSize; i++) {
            const windowSlice = strips.slice(i, i + windowSize);

            const avgRarityRatio = windowSlice.reduce((s, d) => s + d.rarityRatio, 0) / windowSlice.length;
            const avgColorful = windowSlice.reduce((s, d) => s + d.colorfulRatio, 0) / windowSlice.length;
            const avgVariance = windowSlice.reduce((s, d) => s + d.variance, 0) / windowSlice.length;

            let score = 0;

            if (avgRarityRatio > 0.01) {
                score += avgRarityRatio * 200;
            }
            if (avgColorful > 0.03) {
                score += avgColorful * 80;
            }
            if (avgVariance > 200) {
                score += Math.min(30, avgVariance / 50);
            }

            // Prefer lower on screen
            const yPosition = windowSlice[0].y / height;
            if (yPosition > 0.88) {
                score += 30;
            } else if (yPosition > 0.82) {
                score += 15;
            }

            if (score > bestScore) {
                bestScore = score;
                bestBandStart = windowSlice[0].y;
                bestBandEnd = windowSlice[windowSlice.length - 1].y + stripHeight;
            }
        }

        // Constrain band height
        const maxBandHeight = Math.floor(height * 0.15);
        const minBandHeight = Math.floor(height * 0.05);

        if (bestBandEnd - bestBandStart > maxBandHeight) {
            bestBandStart = bestBandEnd - maxBandHeight;
        }
        if (bestBandEnd - bestBandStart < minBandHeight) {
            bestBandStart = bestBandEnd - minBandHeight;
        }

        // Fallback if nothing detected
        if (bestScore < 10) {
            bestBandStart = Math.floor(height * 0.85);
            bestBandEnd = height - 5;
        }

        return {
            topY: bestBandStart,
            bottomY: bestBandEnd,
            confidence: Math.min(1, bestScore / 100),
        };
    }

    /**
     * Detect vertical edges (icon borders) using rarity colors (ported from real detector)
     */
    private detectIconEdges(
        ctx: any,
        width: number,
        bandRegion: { topY: number; bottomY: number }
    ): number[] {
        const { topY, bottomY } = bandRegion;
        const bandHeight = bottomY - topY;

        // Only scan center 70% of width
        const scanStartX = Math.floor(width * 0.15);
        const scanEndX = Math.floor(width * 0.85);

        // Scan multiple horizontal lines within the band
        const scanYOffsets = [0.1, 0.25, 0.5, 0.75, 0.9];
        const edgeCounts = new Map<number, number>();

        for (const yOffset of scanYOffsets) {
            const scanY = Math.floor(topY + bandHeight * yOffset);
            if (scanY >= ctx.canvas.height) continue;

            const lineData = ctx.getImageData(scanStartX, scanY, scanEndX - scanStartX, 1);
            const pixels = lineData.data;

            let inBorder = false;
            let borderStart = -1;

            for (let localX = 0; localX < scanEndX - scanStartX; localX++) {
                const x = localX + scanStartX;
                const idx = localX * 4;
                const r = pixels[idx] ?? 0;
                const g = pixels[idx + 1] ?? 0;
                const b = pixels[idx + 2] ?? 0;

                const rarity = detectRarityAtPixel(r, g, b);

                if (rarity && !inBorder) {
                    inBorder = true;
                    borderStart = x;
                } else if (!rarity && inBorder) {
                    const borderWidth = x - borderStart;

                    // Valid borders are 2-8 pixels wide
                    if (borderWidth >= 2 && borderWidth <= 8) {
                        const bucket = Math.round(borderStart / 4) * 4;
                        edgeCounts.set(bucket, (edgeCounts.get(bucket) || 0) + 1);
                    }

                    inBorder = false;
                }
            }
        }

        // Filter to edges detected in multiple scan lines
        const consistentEdges: number[] = [];
        for (const [x, count] of edgeCounts) {
            if (count >= 2) {
                consistentEdges.push(x);
            }
        }

        consistentEdges.sort((a, b) => a - b);
        return this.filterByConsistentSpacing(consistentEdges);
    }

    /**
     * Filter edges to keep only those with consistent spacing
     */
    private filterByConsistentSpacing(edges: number[]): number[] {
        if (edges.length < 3) return edges;

        const gaps: Array<{ gap: number; fromIdx: number; toIdx: number }> = [];
        for (let i = 1; i < edges.length; i++) {
            const gap = edges[i] - edges[i - 1];
            if (gap > 20 && gap < 120) {
                gaps.push({ gap, fromIdx: i - 1, toIdx: i });
            }
        }

        if (gaps.length < 2) return edges;

        const gapCounts = new Map<number, number>();
        const tolerance = 4;

        for (const { gap } of gaps) {
            const bucket = Math.round(gap / tolerance) * tolerance;
            gapCounts.set(bucket, (gapCounts.get(bucket) || 0) + 1);
        }

        let modeGap = 0;
        let modeCount = 0;
        for (const [bucket, count] of gapCounts) {
            if (count > modeCount) {
                modeCount = count;
                modeGap = bucket;
            }
        }

        if (modeCount < 2) return edges;

        const consistentIndices = new Set<number>();
        for (const { gap, fromIdx, toIdx } of gaps) {
            if (Math.abs(gap - modeGap) <= tolerance) {
                consistentIndices.add(fromIdx);
                consistentIndices.add(toIdx);
            }
        }

        return edges.filter((_, idx) => consistentIndices.has(idx));
    }

    /**
     * Infer grid structure from detected edges (ported from real detector)
     */
    private inferGridFromEdges(
        edges: number[],
        hotbarRegion: { topY: number; bottomY: number },
        width: number
    ): GridParameters | null {
        if (edges.length < 2) {
            return null;
        }

        // Calculate spacings between edges
        const spacings: number[] = [];
        for (let i = 1; i < edges.length; i++) {
            const spacing = edges[i] - edges[i - 1];
            if (spacing > 20 && spacing < 120) {
                spacings.push(spacing);
            }
        }

        if (spacings.length < 1) {
            return null;
        }

        // Find the mode spacing
        const spacingCounts = new Map<number, number>();
        const tolerance = 6;

        for (const spacing of spacings) {
            const bucket = Math.round(spacing / tolerance) * tolerance;
            spacingCounts.set(bucket, (spacingCounts.get(bucket) || 0) + 1);
        }

        let modeSpacing = 0;
        let modeCount = 0;
        for (const [bucket, count] of spacingCounts) {
            if (count > modeCount) {
                modeCount = count;
                modeSpacing = bucket;
            }
        }

        if (modeCount < 2 || modeSpacing < 25) {
            return null;
        }

        // P3.3: Validate spacing against resolution-expected icon size
        // Allow 50% tolerance from expected icon size
        const expectedParams = this.getGridParamsForResolution(width, hotbarRegion.bottomY);
        const expectedIconSize = expectedParams.iconSize + expectedParams.spacing;
        const sizeRatio = modeSpacing / expectedIconSize;

        // If detected spacing is way off from expected (not within 50-150%), reduce confidence
        const isReasonableSize = sizeRatio >= 0.5 && sizeRatio <= 1.5;

        // Find first edge that starts consistent sequence
        let startX = edges[0];
        for (let i = 0; i < edges.length - 1; i++) {
            const gap = edges[i + 1] - edges[i];
            if (Math.abs(gap - modeSpacing) <= tolerance) {
                startX = edges[i];
                break;
            }
        }

        // Count consistent columns
        let columns = 1;
        let lastEdge = startX;
        for (let i = 0; i < edges.length; i++) {
            if (edges[i] <= lastEdge) continue;
            const gap = edges[i] - lastEdge;
            if (Math.abs(gap - modeSpacing) <= tolerance) {
                columns++;
                lastEdge = edges[i];
            }
        }

        // Calculate confidence - penalize if size is unreasonable
        const expectedEdges = columns;
        const actualConsistentEdges = modeCount + 1;
        let confidence = Math.min(1, actualConsistentEdges / Math.max(3, expectedEdges));

        // P3.3: Apply size reasonableness penalty
        if (!isReasonableSize) {
            confidence *= 0.5;
        }

        // Determine rows based on hotbar height
        const bandHeight = hotbarRegion.bottomY - hotbarRegion.topY;
        const rows = Math.max(1, Math.min(3, Math.round(bandHeight / modeSpacing)));

        // P3.3: Clamp cell dimensions to reasonable range
        const clampedCellSize = isReasonableSize
            ? modeSpacing
            : Math.max(30, Math.min(100, modeSpacing));

        return {
            startX,
            startY: hotbarRegion.topY,
            cellWidth: clampedCellSize,
            cellHeight: clampedCellSize,
            columns,
            rows,
            confidence,
        };
    }

    /**
     * Generate grid cell ROIs from grid parameters
     */
    private generateGridROIs(grid: GridParameters, maxCells: number = 50): Array<{ x: number; y: number; width: number; height: number }> {
        const cells: Array<{ x: number; y: number; width: number; height: number }> = [];

        for (let row = 0; row < grid.rows && cells.length < maxCells; row++) {
            for (let col = 0; col < grid.columns && cells.length < maxCells; col++) {
                cells.push({
                    x: grid.startX + col * grid.cellWidth,
                    y: grid.startY + row * grid.cellHeight,
                    width: grid.cellWidth,
                    height: grid.cellHeight,
                });
            }
        }

        return cells;
    }

    /**
     * Load item templates from game data at multiple scales
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
            console.log(`   Loading ${items.length} item templates at ${TEMPLATE_SCALES.length} scales...`);
        }

        // Load each item's image as template at multiple scales
        for (const item of items) {
            if (!item.image) continue;

            try {
                // Use PNG (node-canvas doesn't support WebP)
                const imagePath = path.join(__dirname, '../src/', item.image);
                if (!fs.existsSync(imagePath)) continue;

                const img = await loadImage(imagePath);

                // Create templates at each scale
                const scaleMap = new Map<number, TemplateData>();

                for (const scale of TEMPLATE_SCALES) {
                    const canvas = createCanvas(scale, scale);
                    const ctx = canvas.getContext('2d');

                    // Draw with scaling
                    ctx.drawImage(
                        img,
                        0, 0, img.width, img.height,  // Source
                        0, 0, scale, scale  // Dest
                    );

                    scaleMap.set(scale, {
                        item,
                        canvas,
                        ctx,
                        width: scale,
                        height: scale,
                    });
                }

                multiScaleTemplates.set(item.id, scaleMap);

                // Also store default scale in legacy cache for compatibility
                const templateData = scaleMap.get(DEFAULT_TEMPLATE_SIZE)!;

                templateCache.set(item.id, templateData);

                // Group by rarity for faster filtering
                if (!templatesByRarity.has(item.rarity)) {
                    templatesByRarity.set(item.rarity, []);
                }
                templatesByRarity.get(item.rarity)!.push(templateData);
            } catch {
                // Skip failed templates
            }
        }

        if (this.config.verbose) {
            console.log(`   Loaded ${templateCache.size} templates`);
            const rarityBreakdown = Array.from(templatesByRarity.entries())
                .map(([r, t]) => `${r}:${t.length}`)
                .join(', ');
            console.log(`   By rarity: ${rarityBreakdown}`);
        }
    }

    /**
     * Resolution-aware grid parameters
     * P3.1: Tuned for specific resolution categories
     */
    private getGridParamsForResolution(width: number, height: number): {
        iconSize: number;
        spacing: number;
        bottomMargin: number;
        sideMargin: number;
        maxRows: number;
    } {
        // Detect resolution category
        const isUltrawide = width / height > 1.9;
        const is4K = height >= 2000;
        const is1440p = height >= 1400 && height < 2000;
        const is1080p = height >= 1000 && height < 1400;
        const is720p = height < 1000;

        // Resolution-specific tuning
        if (is4K) {
            return {
                iconSize: 80,
                spacing: 8,
                bottomMargin: 40,
                sideMargin: width * 0.15,
                maxRows: 3,
            };
        } else if (is1440p) {
            return {
                iconSize: 64,
                spacing: 6,
                bottomMargin: 32,
                sideMargin: width * 0.15,
                maxRows: 3,
            };
        } else if (is1080p) {
            return {
                iconSize: 52,
                spacing: 5,
                bottomMargin: 26,
                sideMargin: width * 0.18,
                maxRows: 3,
            };
        } else { // 720p and below
            return {
                iconSize: 40,
                spacing: 4,
                bottomMargin: 20,
                sideMargin: width * 0.20,
                maxRows: 2,
            };
        }
    }

    /**
     * Static fallback grid detection when dynamic detection fails
     * P3.1: Uses resolution-aware parameters
     */
    private detectGridPositionsStatic(width: number, height: number): Array<{ x: number; y: number; width: number; height: number }> {
        const params = this.getGridParamsForResolution(width, height);
        const { iconSize, spacing, bottomMargin, sideMargin, maxRows } = params;

        const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
        const rowHeight = iconSize + spacing;

        // Generate row Y positions from bottom up
        const rowYPositions: number[] = [];
        for (let row = 0; row < maxRows; row++) {
            rowYPositions.push(height - bottomMargin - iconSize - row * rowHeight);
        }

        const usableWidth = width - sideMargin * 2;
        const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

        for (const rowY of rowYPositions) {
            // Only include rows in the bottom portion of screen
            if (rowY < height * 0.70) break;

            // Calculate centered start position
            const totalWidth = maxItemsPerRow * (iconSize + spacing);
            const startX = Math.round((width - totalWidth) / 2);

            // Add positions for this row
            for (let i = 0; i < maxItemsPerRow; i++) {
                positions.push({
                    x: startX + i * (iconSize + spacing),
                    y: rowY,
                    width: iconSize,
                    height: iconSize,
                });
            }
        }

        return positions;
    }

    /**
     * Check if a cell is empty or not an item slot
     * Simple variance and darkness check - permissive to avoid missing items
     */
    private isEmptyCell(imageData: any): boolean {
        const pixels = imageData.data;

        let sum = 0, sumSq = 0, count = 0;

        // Sample pixels (every 4th for speed)
        for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const gray = (r + g + b) / 3;

            sum += gray;
            sumSq += gray * gray;
            count++;
        }

        const mean = sum / count;
        const variance = sumSq / count - mean * mean;

        // Only reject very uniform or very dark cells
        if (variance < 150) return true;  // Very uniform = empty
        if (mean < 30) return true;       // Very dark = background

        return false;
    }

    /**
     * Detect rarity from item border color
     * Returns the most likely rarity based on border pixel colors
     */
    /**
     * Detect rarity from border color using HSL-based matching (ported from real detector)
     */
    private detectRarityFromBorder(imageData: any): string | null {
        const { width, height, data } = imageData;
        const borderPixels = 3;

        // Count votes for each rarity
        const rarityVotes: Record<string, number> = {
            common: 0,
            uncommon: 0,
            rare: 0,
            epic: 0,
            legendary: 0,
        };

        let totalPixels = 0;

        // Top edge
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < borderPixels; y++) {
                const idx = (y * width + x) * 4;
                const r = data[idx] ?? 0;
                const g = data[idx + 1] ?? 0;
                const b = data[idx + 2] ?? 0;

                const rarity = detectRarityAtPixel(r, g, b);
                if (rarity) {
                    rarityVotes[rarity]++;
                }
                totalPixels++;
            }
        }

        // Left edge
        for (let y = borderPixels; y < height; y++) {
            for (let x = 0; x < borderPixels; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx] ?? 0;
                const g = data[idx + 1] ?? 0;
                const b = data[idx + 2] ?? 0;

                const rarity = detectRarityAtPixel(r, g, b);
                if (rarity) {
                    rarityVotes[rarity]++;
                }
                totalPixels++;
            }
        }

        // Find rarity with most votes
        let bestMatch: string | null = null;
        let bestVotes = 0;

        for (const [rarity, votes] of Object.entries(rarityVotes)) {
            if (votes > bestVotes) {
                bestVotes = votes;
                bestMatch = rarity;
            }
        }

        // Require at least 10% of border pixels to match
        const minVoteRatio = 0.1;
        if (bestVotes < totalPixels * minVoteRatio) {
            return null;
        }

        return bestMatch;
    }

    /**
     * Find best matching template for a cell using multi-scale matching
     * Tries all template scales and picks the best match
     */
    private async findBestMatch(
        cellImageData: any,
        strategy: CVStrategy
    ): Promise<{ item: GameItem; confidence: number; rarity?: string } | null> {
        // Try to detect rarity from border
        const detectedRarity = this.detectRarityFromBorder(cellImageData);

        // Get candidate item IDs - filter by rarity if detected
        let candidateIds: string[];
        if (detectedRarity && templatesByRarity.has(detectedRarity)) {
            candidateIds = templatesByRarity.get(detectedRarity)!.map(t => t.item.id);
        } else {
            // Fall back to all templates
            candidateIds = Array.from(templateCache.keys());
        }

        let bestMatch: { item: GameItem; confidence: number; rarity?: string } | null = null;

        // Extract center region of cell (ignore edges that might have background)
        const margin = Math.round(cellImageData.width * 0.20);
        const centerWidth = cellImageData.width - margin * 2;
        const centerHeight = cellImageData.height - margin * 2;

        // Put cell image data on a temp canvas for scaling
        const tempCanvas = createCanvas(cellImageData.width, cellImageData.height);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(cellImageData, 0, 0);

        // Pre-create cell data at each scale
        const cellDataByScale = new Map<number, any>();
        for (const scale of TEMPLATE_SCALES) {
            const cellCanvas = createCanvas(scale, scale);
            const cellCtx = cellCanvas.getContext('2d');

            // Draw center region of cell, scaled to this template size
            cellCtx.drawImage(
                tempCanvas,
                margin, margin,  // Source x, y (center crop)
                centerWidth, centerHeight,  // Source size
                0, 0,  // Dest x, y
                scale, scale  // Dest size
            );
            cellDataByScale.set(scale, cellCtx.getImageData(0, 0, scale, scale));
        }

        // Try each candidate at each scale
        for (const itemId of candidateIds) {
            const scaleMap = multiScaleTemplates.get(itemId);
            if (!scaleMap) continue;

            // Try each scale and keep the best
            for (const scale of TEMPLATE_SCALES) {
                const template = scaleMap.get(scale);
                if (!template) continue;

                const cellData = cellDataByScale.get(scale);
                if (!cellData) continue;

                // Extract center region of template
                const tMargin = Math.round(scale * 0.15);
                const tCenterSize = scale - tMargin * 2;

                const templateCenterCanvas = createCanvas(scale, scale);
                const templateCenterCtx = templateCenterCanvas.getContext('2d');

                templateCenterCtx.drawImage(
                    template.canvas,
                    tMargin, tMargin,
                    tCenterSize, tCenterSize,
                    0, 0,
                    scale, scale
                );
                const templateData = templateCenterCtx.getImageData(0, 0, scale, scale);

                // Calculate similarity
                let similarity = this.calculateCombinedSimilarity(cellData, templateData);

                // Boost confidence if rarity matches
                if (detectedRarity && template.item.rarity === detectedRarity) {
                    similarity *= 1.15;
                }

                // Clamp to max 0.99
                similarity = Math.min(0.99, similarity);

                if (!bestMatch || similarity > bestMatch.confidence) {
                    bestMatch = {
                        item: template.item,
                        confidence: similarity,
                        rarity: detectedRarity || undefined
                    };
                }
            }
        }

        return bestMatch;
    }

    /**
     * Enhance contrast of image (scientific testing showed +29% F1 improvement)
     */
    private enhanceContrast(imageData: any, factor: number = 1.5): any {
        const data = new Uint8ClampedArray(imageData.data);
        const midpoint = 128;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, midpoint + (data[i] - midpoint) * factor));
            data[i + 1] = Math.min(255, Math.max(0, midpoint + (data[i + 1] - midpoint) * factor));
            data[i + 2] = Math.min(255, Math.max(0, midpoint + (data[i + 2] - midpoint) * factor));
        }
        return { data, width: imageData.width, height: imageData.height };
    }

    /**
     * Normalize colors to full range (scientific testing showed +10% cumulative F1 improvement)
     */
    private normalizeColors(imageData: any): any {
        const data = new Uint8ClampedArray(imageData.data);
        let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        for (let i = 0; i < data.length; i += 4) {
            minR = Math.min(minR, data[i]); maxR = Math.max(maxR, data[i]);
            minG = Math.min(minG, data[i+1]); maxG = Math.max(maxG, data[i+1]);
            minB = Math.min(minB, data[i+2]); maxB = Math.max(maxB, data[i+2]);
        }
        const rangeR = maxR - minR || 1, rangeG = maxG - minG || 1, rangeB = maxB - minB || 1;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round((data[i] - minR) / rangeR * 255);
            data[i+1] = Math.round((data[i+1] - minG) / rangeG * 255);
            data[i+2] = Math.round((data[i+2] - minB) / rangeB * 255);
        }
        return { data, width: imageData.width, height: imageData.height };
    }

    /**
     * Sharpen image using unsharp mask technique
     * Enhances edges for better template matching
     */
    private sharpenImage(imageData: any, strength: number = 0.5): any {
        const { width, height, data: src } = imageData;
        const data = new Uint8ClampedArray(src);

        // Simple 3x3 sharpen kernel applied via convolution
        // kernel: [0, -s, 0], [-s, 1+4s, -s], [0, -s, 0]
        const s = strength;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                for (let c = 0; c < 3; c++) {
                    const center = src[idx + c];
                    const top = src[idx - width * 4 + c];
                    const bottom = src[idx + width * 4 + c];
                    const left = src[idx - 4 + c];
                    const right = src[idx + 4 + c];

                    // Apply sharpening kernel
                    const sharpened = center * (1 + 4 * s) - s * (top + bottom + left + right);
                    data[idx + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
                }
            }
        }

        return { data, width, height };
    }

    /**
     * Local adaptive histogram equalization (simplified CLAHE)
     * Better than global equalization for varying lighting conditions
     */
    private adaptiveHistogramEqualization(imageData: any): any {
        const { width, height, data: src } = imageData;
        const data = new Uint8ClampedArray(src);

        // Work on grayscale luminance
        const gray = new Float32Array(width * height);
        for (let i = 0, j = 0; i < src.length; i += 4, j++) {
            gray[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
        }

        // Build global histogram
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < gray.length; i++) {
            histogram[Math.floor(gray[i])]++;
        }

        // Build CDF (cumulative distribution function)
        const cdf = new Array(256);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + histogram[i];
        }

        // Find min non-zero CDF value
        let cdfMin = 0;
        for (let i = 0; i < 256; i++) {
            if (cdf[i] > 0) {
                cdfMin = cdf[i];
                break;
            }
        }

        // Apply histogram equalization
        const totalPixels = width * height;
        const scale = 255 / (totalPixels - cdfMin);

        for (let i = 0, j = 0; i < src.length; i += 4, j++) {
            const oldGray = Math.floor(gray[j]);
            const newGray = Math.round((cdf[oldGray] - cdfMin) * scale);

            // Apply proportionally to each channel
            const ratio = oldGray > 0 ? newGray / oldGray : 1;
            data[i] = Math.min(255, Math.max(0, Math.round(src[i] * ratio)));
            data[i + 1] = Math.min(255, Math.max(0, Math.round(src[i + 1] * ratio)));
            data[i + 2] = Math.min(255, Math.max(0, Math.round(src[i + 2] * ratio)));
        }

        return { data, width, height };
    }

    /**
     * SSIM (Structural Similarity) - more robust than NCC for image comparison
     */
    private calculateSSIM(img1: any, img2: any): number {
        if (img1.width !== img2.width || img1.height !== img2.height) return 0;
        const data1 = img1.data, data2 = img2.data;
        const n = data1.length / 4;
        let mean1 = 0, mean2 = 0;
        const gray1: number[] = [], gray2: number[] = [];
        for (let i = 0; i < data1.length; i += 4) {
            const g1 = (data1[i] + data1[i+1] + data1[i+2]) / 3;
            const g2 = (data2[i] + data2[i+1] + data2[i+2]) / 3;
            gray1.push(g1); gray2.push(g2);
            mean1 += g1; mean2 += g2;
        }
        mean1 /= n; mean2 /= n;
        let var1 = 0, var2 = 0, covar = 0;
        for (let i = 0; i < n; i++) {
            const d1 = gray1[i] - mean1, d2 = gray2[i] - mean2;
            var1 += d1 * d1; var2 += d2 * d2; covar += d1 * d2;
        }
        var1 /= n; var2 /= n; covar /= n;
        const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
        const ssim = ((2 * mean1 * mean2 + C1) * (2 * covar + C2)) / ((mean1 ** 2 + mean2 ** 2 + C1) * (var1 + var2 + C2));
        // SSIM returns value in [-1, 1] range, clamp to [0, 1] for similarity score
        // Note: Don't apply (ssim+1)/2 transformation - that inflates scores
        return Math.max(0, ssim);
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
     * Color histogram comparison
     * Compares color distribution - robust to position shifts and small variations
     */
    private calculateHistogramSimilarity(imageData1: any, imageData2: any): number {
        const bins = 8; // 8 bins per channel = 512 combinations (optimized from 16 for speed)
        const binSize = 256 / bins;

        // Build histograms for both images
        const hist1 = new Array(bins * bins * bins).fill(0);
        const hist2 = new Array(bins * bins * bins).fill(0);

        const pixels1 = imageData1.data;
        const pixels2 = imageData2.data;

        let count1 = 0, count2 = 0;

        // Build histogram 1
        for (let i = 0; i < pixels1.length; i += 4) {
            const rBin = Math.min(bins - 1, Math.floor(pixels1[i] / binSize));
            const gBin = Math.min(bins - 1, Math.floor(pixels1[i + 1] / binSize));
            const bBin = Math.min(bins - 1, Math.floor(pixels1[i + 2] / binSize));
            const idx = rBin * bins * bins + gBin * bins + bBin;
            hist1[idx]++;
            count1++;
        }

        // Build histogram 2
        for (let i = 0; i < pixels2.length; i += 4) {
            const rBin = Math.min(bins - 1, Math.floor(pixels2[i] / binSize));
            const gBin = Math.min(bins - 1, Math.floor(pixels2[i + 1] / binSize));
            const bBin = Math.min(bins - 1, Math.floor(pixels2[i + 2] / binSize));
            const idx = rBin * bins * bins + gBin * bins + bBin;
            hist2[idx]++;
            count2++;
        }

        // Normalize histograms
        for (let i = 0; i < hist1.length; i++) {
            hist1[i] /= count1;
            hist2[i] /= count2;
        }

        // Calculate intersection (similarity)
        let intersection = 0;
        for (let i = 0; i < hist1.length; i++) {
            intersection += Math.min(hist1[i], hist2[i]);
        }

        return intersection;
    }

    /**
     * Edge-based similarity using Sobel-like edge detection
     * Compares edge patterns - robust to color/lighting variations
     */
    private calculateEdgeSimilarity(imageData1: any, imageData2: any): number {
        const { width: w1, height: h1 } = imageData1;
        const { width: w2, height: h2 } = imageData2;

        if (w1 !== w2 || h1 !== h2) return 0;

        const pixels1 = imageData1.data;
        const pixels2 = imageData2.data;

        // Convert to grayscale and detect edges
        const getGray = (pixels: any, x: number, y: number, width: number): number => {
            const idx = (y * width + x) * 4;
            return (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
        };

        // Simple edge detection (gradient magnitude)
        const getEdge = (pixels: any, x: number, y: number, width: number, height: number): number => {
            if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) return 0;

            const gx = getGray(pixels, x + 1, y, width) - getGray(pixels, x - 1, y, width);
            const gy = getGray(pixels, x, y + 1, width) - getGray(pixels, x, y - 1, width);

            return Math.sqrt(gx * gx + gy * gy);
        };

        // Compare edge patterns
        let sumProduct = 0, sumSq1 = 0, sumSq2 = 0;

        for (let y = 1; y < h1 - 1; y += 2) { // Sample every other pixel for speed
            for (let x = 1; x < w1 - 1; x += 2) {
                const e1 = getEdge(pixels1, x, y, w1, h1);
                const e2 = getEdge(pixels2, x, y, w2, h2);

                sumProduct += e1 * e2;
                sumSq1 += e1 * e1;
                sumSq2 += e2 * e2;
            }
        }

        const denominator = Math.sqrt(sumSq1 * sumSq2);
        if (denominator === 0) return 0;

        return sumProduct / denominator;
    }

    /**
     * Combined similarity score using multiple methods
     * Optimized preprocessing for speed while maintaining accuracy
     */
    private calculateCombinedSimilarity(imageData1: any, imageData2: any): number {
        // Lightweight preprocessing (skip heavy operations for speed)
        // Just contrast + normalization (proven effective, fast)
        let processed1 = this.enhanceContrast(imageData1, 1.4);
        processed1 = this.normalizeColors(processed1);

        let processed2 = this.enhanceContrast(imageData2, 1.4);
        processed2 = this.normalizeColors(processed2);

        // Calculate similarity metrics (skip edge similarity for speed)
        const ssim = this.calculateSSIM(processed1, processed2);
        const ncc = this.calculateNCC(processed1, processed2);
        const histogram = this.calculateHistogramSimilarity(processed1, processed2);

        // Weighted combination optimized for accuracy
        const weights = { ssim: 0.40, ncc: 0.35, histogram: 0.25 };
        const weightedScore =
            ssim * weights.ssim +
            ncc * weights.ncc +
            histogram * weights.histogram;

        // Bonus if methods agree
        let agreementBonus = 0;
        const highScores = [ssim, ncc, histogram].filter(s => s > 0.5).length;
        if (highScores >= 2) agreementBonus = 0.03;

        return Math.min(0.99, weightedScore + agreementBonus);
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
     * Print detailed debug info for detection comparison
     */
    private printDetectionDebug(
        detections: Array<{ id: string; name: string; confidence: number }>,
        groundTruth: TestCase['groundTruth'],
        metrics: { truePositives: number; falsePositives: number; falseNegatives: number }
    ): void {
        // Count detected items by ID
        const detectedCounts = new Map<string, { count: number; name: string; avgConf: number }>();
        for (const d of detections) {
            const existing = detectedCounts.get(d.id);
            if (existing) {
                existing.count++;
                existing.avgConf = (existing.avgConf * (existing.count - 1) + d.confidence) / existing.count;
            } else {
                detectedCounts.set(d.id, { count: 1, name: d.name, avgConf: d.confidence });
            }
        }

        // Count expected items by ID
        const expectedCounts = new Map<string, { count: number; name: string }>();
        for (const item of groundTruth.items) {
            expectedCounts.set(item.id, { count: item.count, name: item.name });
        }

        // Find true positives, false positives, false negatives
        const truePositiveItems: string[] = [];
        const falsePositiveItems: string[] = [];
        const falseNegativeItems: string[] = [];

        for (const [id, data] of detectedCounts) {
            const expected = expectedCounts.get(id);
            if (expected) {
                const matched = Math.min(data.count, expected.count);
                if (matched > 0) {
                    truePositiveItems.push(`${data.name} (${matched}/${expected.count}, conf=${(data.avgConf * 100).toFixed(0)}%)`);
                }
                if (data.count > expected.count) {
                    falsePositiveItems.push(`${data.name} (+${data.count - expected.count} extra)`);
                }
            } else {
                falsePositiveItems.push(`${data.name} (x${data.count}, conf=${(data.avgConf * 100).toFixed(0)}%)`);
            }
        }

        for (const [id, data] of expectedCounts) {
            const detected = detectedCounts.get(id);
            if (!detected) {
                falseNegativeItems.push(`${data.name} (x${data.count} missed)`);
            } else if (detected.count < data.count) {
                falseNegativeItems.push(`${data.name} (${data.count - detected.count} missed)`);
            }
        }

        console.log(`      📊 TP=${metrics.truePositives}, FP=${metrics.falsePositives}, FN=${metrics.falseNegatives}`);

        if (truePositiveItems.length > 0) {
            console.log(`      ✓ Correct: ${truePositiveItems.slice(0, 5).join(', ')}${truePositiveItems.length > 5 ? ` (+${truePositiveItems.length - 5} more)` : ''}`);
        }

        if (falsePositiveItems.length > 0) {
            console.log(`      ✗ Wrong: ${falsePositiveItems.slice(0, 5).join(', ')}${falsePositiveItems.length > 5 ? ` (+${falsePositiveItems.length - 5} more)` : ''}`);
        }

        if (falseNegativeItems.length > 0) {
            console.log(`      ○ Missed: ${falseNegativeItems.slice(0, 5).join(', ')}${falseNegativeItems.length > 5 ? ` (+${falseNegativeItems.length - 5} more)` : ''}`);
        }
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
        ablationMode: false,
        ablationQuick: false,
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
        } else if (arg === '--ablation' || arg === '-a') {
            config.ablationMode = true;
        } else if (arg === '--ablation-quick' || arg === '-aq') {
            config.ablationMode = true;
            config.ablationQuick = true;
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
  --ablation, -a         Run ablation tests (toggle pipeline components on/off)
  --ablation-quick, -aq  Run quick ablation tests (subset of configs for faster testing)
  --help, -h             Show this help message

Examples:
  # Run all strategies on default test cases
  bun run tests/offline-cv-runner.ts

  # Run specific strategies
  bun run tests/offline-cv-runner.ts --strategies current,optimized

  # Run full ablation tests (tests all pipeline component combinations)
  bun run tests/offline-cv-runner.ts --ablation

  # Run quick ablation tests (key components only, ~6 configs)
  bun run tests/offline-cv-runner.ts --ablation-quick -v

  # Custom paths with verbose output
  bun run tests/offline-cv-runner.ts --test-cases ./my-tests --output ./results -v

Ablation Testing:
  Ablation mode systematically toggles individual pipeline components on/off
  to identify which components help vs hurt detection accuracy.

  Full ablation tests (~18 configs):
    - baseline-all-on: All features enabled
    - minimal: Only basic SSIM metric
    - no-<component>: Each component disabled individually
    - <metric>-only: Single metric tests
    - with-<feature>: Additional features enabled

  Quick ablation tests (~6 configs):
    - baseline-all-on, minimal, and key component toggles

  Results include:
    - Component impact analysis (which features help/hurt)
    - Sorted ranking by F1 score
    - Delta from baseline for each configuration
`);
}

// Run if executed directly
if (require.main === module) {
    main();
}

export { OfflineCVRunner, TestCase, TestResult, RunnerConfig };
