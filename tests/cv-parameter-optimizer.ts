#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SCIENTIFIC CV PARAMETER OPTIMIZER
// ═══════════════════════════════════════════════════════════════════════════════
// Systematically tests CV parameters to find optimal configurations.
// Outputs chart-ready data in CSV and JSON formats for visualization.
// ═══════════════════════════════════════════════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch {
    console.error('❌ Canvas module required. Install with: npm install canvas');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Single tunable parameter with its test range */
interface Parameter {
    name: string;
    description: string;
    category: 'threshold' | 'color' | 'detection' | 'preprocessing' | 'matching';
    baseline: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    testValues: number[];
}

/** Result of testing a single parameter value */
interface TestResult {
    parameter: string;
    value: number;
    f1Score: number;
    precision: number;
    recall: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    avgConfidence: number;
    processingTimeMs: number;
    deltaFromBaseline: number;
    percentImprovement: number;
}

/** Sensitivity analysis for a parameter */
interface SensitivityAnalysis {
    parameter: string;
    category: string;
    impactScore: number;      // How much F1 varies with this param (std dev)
    optimalValue: number;
    baselineValue: number;
    maxF1: number;
    minF1: number;
    f1Range: number;
    recommendation: string;
    rank: number;
}

/** Ground truth for a test image */
interface GroundTruth {
    items: string[];          // Item names present
    character?: string;
    weapon?: string;
    tomes?: string[];
}

/** Test case with image and expected results */
interface TestCase {
    name: string;
    imagePath: string;
    groundTruth: GroundTruth;
    resolution: string;
}

/** Template data for matching */
interface TemplateData {
    id: string;
    name: string;
    rarity: string;
    canvas: any;
    ctx: any;
    width: number;
    height: number;
    dominantColor: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARAMETER DEFINITIONS - ALL TUNABLE VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

const PARAMETERS: Parameter[] = [
    // ─────────────────────────────────────────────────────────────────────────
    // CONFIDENCE THRESHOLDS
    // ─────────────────────────────────────────────────────────────────────────
    {
        name: 'minConfidence',
        description: 'Minimum confidence to accept a detection',
        category: 'threshold',
        baseline: 0.72,
        min: 0.50,
        max: 0.90,
        step: 0.05,
        unit: '',
        testValues: [0.50, 0.55, 0.60, 0.65, 0.70, 0.72, 0.75, 0.78, 0.80, 0.85, 0.90],
    },
    {
        name: 'pass1Threshold',
        description: 'High-confidence first pass threshold',
        category: 'threshold',
        baseline: 0.85,
        min: 0.75,
        max: 0.95,
        step: 0.02,
        unit: '',
        testValues: [0.75, 0.78, 0.80, 0.82, 0.85, 0.88, 0.90, 0.92, 0.95],
    },
    {
        name: 'pass2Threshold',
        description: 'Medium-confidence second pass threshold',
        category: 'threshold',
        baseline: 0.70,
        min: 0.55,
        max: 0.80,
        step: 0.05,
        unit: '',
        testValues: [0.55, 0.60, 0.65, 0.70, 0.72, 0.75, 0.78, 0.80],
    },
    {
        name: 'pass3Threshold',
        description: 'Low-confidence third pass threshold',
        category: 'threshold',
        baseline: 0.60,
        min: 0.40,
        max: 0.70,
        step: 0.05,
        unit: '',
        testValues: [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70],
    },
    {
        name: 'nmsIouThreshold',
        description: 'IoU threshold for non-maximum suppression',
        category: 'threshold',
        baseline: 0.30,
        min: 0.10,
        max: 0.60,
        step: 0.05,
        unit: '',
        testValues: [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // COLOR ANALYSIS THRESHOLDS
    // ─────────────────────────────────────────────────────────────────────────
    {
        name: 'colorSaturationThreshold',
        description: 'RGB difference to consider color vs grayscale',
        category: 'color',
        baseline: 30,
        min: 15,
        max: 60,
        step: 5,
        unit: 'units',
        testValues: [15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
    },
    {
        name: 'blackBrightnessThreshold',
        description: 'Brightness below which is considered black',
        category: 'color',
        baseline: 60,
        min: 30,
        max: 90,
        step: 10,
        unit: 'units',
        testValues: [30, 40, 50, 60, 70, 80, 90],
    },
    {
        name: 'whiteBrightnessThreshold',
        description: 'Brightness above which is considered white',
        category: 'color',
        baseline: 200,
        min: 170,
        max: 230,
        step: 10,
        unit: 'units',
        testValues: [170, 180, 190, 200, 210, 220, 230],
    },
    {
        name: 'borderColorTolerance',
        description: 'Color distance tolerance for border rarity detection',
        category: 'color',
        baseline: 60,
        min: 30,
        max: 100,
        step: 10,
        unit: 'units',
        testValues: [30, 40, 50, 60, 70, 80, 90, 100],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DETECTION PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────
    {
        name: 'slidingWindowStep',
        description: 'Step size for sliding window scan',
        category: 'detection',
        baseline: 12,
        min: 4,
        max: 24,
        step: 2,
        unit: 'px',
        testValues: [4, 6, 8, 10, 12, 14, 16, 18, 20, 24],
    },
    {
        name: 'emptyVarianceThreshold',
        description: 'Variance below which cell is considered empty',
        category: 'detection',
        baseline: 500,
        min: 200,
        max: 1000,
        step: 100,
        unit: '',
        testValues: [200, 300, 400, 500, 600, 700, 800, 900, 1000],
    },
    {
        name: 'lowDetailVarianceThreshold',
        description: 'Variance below which region is skipped',
        category: 'detection',
        baseline: 800,
        min: 400,
        max: 1200,
        step: 100,
        unit: '',
        testValues: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
    },
    {
        name: 'iconRegionPercent',
        description: 'Percent of cell to use for icon (exclude count)',
        category: 'detection',
        baseline: 80,
        min: 65,
        max: 95,
        step: 5,
        unit: '%',
        testValues: [65, 70, 75, 80, 85, 90, 95],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PREPROCESSING PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────
    {
        name: 'contrastFactor',
        description: 'Contrast enhancement multiplier',
        category: 'preprocessing',
        baseline: 1.0,
        min: 0.8,
        max: 2.0,
        step: 0.1,
        unit: 'x',
        testValues: [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0],
    },
    {
        name: 'templateMarginPercent',
        description: 'Margin to crop from template edges',
        category: 'preprocessing',
        baseline: 15,
        min: 5,
        max: 25,
        step: 2,
        unit: '%',
        testValues: [5, 7, 10, 12, 15, 17, 20, 22, 25],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MATCHING ALGORITHM PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────
    {
        name: 'histogramBins',
        description: 'Number of bins per channel for histogram',
        category: 'matching',
        baseline: 8,
        min: 4,
        max: 16,
        step: 2,
        unit: '',
        testValues: [4, 6, 8, 10, 12, 16],
    },
    {
        name: 'contextBoostCommon',
        description: 'Confidence boost for common items',
        category: 'matching',
        baseline: 0.03,
        min: 0.00,
        max: 0.08,
        step: 0.01,
        unit: '',
        testValues: [0.00, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08],
    },
    {
        name: 'borderMatchBoost',
        description: 'Confidence boost when border rarity matches',
        category: 'matching',
        baseline: 1.05,
        min: 1.00,
        max: 1.15,
        step: 0.02,
        unit: 'x',
        testValues: [1.00, 1.02, 1.04, 1.05, 1.06, 1.08, 1.10, 1.15],
    },
    {
        name: 'borderMismatchPenalty',
        description: 'Confidence penalty when border rarity mismatches',
        category: 'matching',
        baseline: 0.85,
        min: 0.70,
        max: 0.95,
        step: 0.05,
        unit: 'x',
        testValues: [0.70, 0.75, 0.80, 0.85, 0.90, 0.95],
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const templateCache = new Map<string, TemplateData>();
const templatesByRarity = new Map<string, TemplateData[]>();
const templatesByColor = new Map<string, TemplateData[]>();

// Current parameter values (can be modified during testing)
let currentParams = new Map<string, number>();

// Initialize with baseline values
PARAMETERS.forEach(p => currentParams.set(p.name, p.baseline));

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getParam(name: string): number {
    return currentParams.get(name) ?? PARAMETERS.find(p => p.name === name)?.baseline ?? 0;
}

function setParam(name: string, value: number): void {
    currentParams.set(name, value);
}

function resetToBaseline(): void {
    PARAMETERS.forEach(p => currentParams.set(p.name, p.baseline));
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR ANALYSIS FUNCTIONS (parameterized)
// ═══════════════════════════════════════════════════════════════════════════════

function getDominantColor(imageData: { data: Uint8ClampedArray; width: number; height: number }): string {
    const pixels = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < pixels.length; i += 16) {
        sumR += pixels[i] ?? 0;
        sumG += pixels[i + 1] ?? 0;
        sumB += pixels[i + 2] ?? 0;
        count++;
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const diff = maxChannel - minChannel;

    const satThreshold = getParam('colorSaturationThreshold');
    const blackThreshold = getParam('blackBrightnessThreshold');
    const whiteThreshold = getParam('whiteBrightnessThreshold');

    if (diff < satThreshold) {
        const brightness = (avgR + avgG + avgB) / 3;
        if (brightness < blackThreshold) return 'black';
        if (brightness > whiteThreshold) return 'white';
        return 'gray';
    }

    if (avgR > avgG && avgR > avgB) {
        if (avgG > avgB * 1.3) return 'orange';
        if (avgR > 180 && avgG > 140) return 'yellow';
        return 'red';
    } else if (avgG > avgR && avgG > avgB) {
        if (avgB > avgR * 1.3) return 'cyan';
        return 'green';
    } else if (avgB > avgR && avgB > avgG) {
        if (avgR > avgG * 1.3) return 'purple';
        return 'blue';
    }

    return 'mixed';
}

function calculateVariance(imageData: { data: Uint8ClampedArray; width: number; height: number }): number {
    const pixels = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

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

function isEmptyCell(imageData: { data: Uint8ClampedArray; width: number; height: number }): boolean {
    const variance = calculateVariance(imageData);
    return variance < getParam('emptyVarianceThreshold');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMILARITY CALCULATION (parameterized)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateNCC(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(data1.length, data2.length);

    for (let i = 0; i < len; i += 4) {
        const g1 = ((data1[i] ?? 0) + (data1[i + 1] ?? 0) + (data1[i + 2] ?? 0)) / 3;
        const g2 = ((data2[i] ?? 0) + (data2[i + 1] ?? 0) + (data2[i + 2] ?? 0)) / 3;
        s1 += g1; s2 += g2; sp += g1 * g2;
        ss1 += g1 * g1; ss2 += g2 * g2; c++;
    }

    const m1 = s1 / c, m2 = s2 / c;
    const num = sp / c - m1 * m2;
    const den = Math.sqrt((ss1 / c - m1 * m1) * (ss2 / c - m2 * m2));

    return den === 0 ? 0 : (num / den + 1) / 2;
}

function calculateHistogramSimilarity(data1: Uint8ClampedArray, data2: Uint8ClampedArray): number {
    const bins = getParam('histogramBins');
    const binSize = 256 / bins;
    const hist1 = new Array(bins * bins * bins).fill(0);
    const hist2 = new Array(bins * bins * bins).fill(0);
    let count1 = 0, count2 = 0;

    for (let i = 0; i < data1.length; i += 4) {
        const idx = Math.min(bins - 1, Math.floor((data1[i] ?? 0) / binSize)) * bins * bins +
                    Math.min(bins - 1, Math.floor((data1[i + 1] ?? 0) / binSize)) * bins +
                    Math.min(bins - 1, Math.floor((data1[i + 2] ?? 0) / binSize));
        hist1[idx]++; count1++;
    }

    for (let i = 0; i < data2.length; i += 4) {
        const idx = Math.min(bins - 1, Math.floor((data2[i] ?? 0) / binSize)) * bins * bins +
                    Math.min(bins - 1, Math.floor((data2[i + 1] ?? 0) / binSize)) * bins +
                    Math.min(bins - 1, Math.floor((data2[i + 2] ?? 0) / binSize));
        hist2[idx]++; count2++;
    }

    for (let i = 0; i < hist1.length; i++) {
        hist1[i] /= count1;
        hist2[i] /= count2;
    }

    let intersection = 0;
    for (let i = 0; i < hist1.length; i++) {
        intersection += Math.min(hist1[i], hist2[i]);
    }

    return intersection;
}

function calculateSimilarity(cellData: Uint8ClampedArray, templateData: Uint8ClampedArray): number {
    const ncc = calculateNCC(cellData, templateData);
    const histogram = calculateHistogramSimilarity(cellData, templateData);

    // Weighted combination
    return ncc * 0.6 + histogram * 0.4;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREPROCESSING (parameterized)
// ═══════════════════════════════════════════════════════════════════════════════

function enhanceContrast(data: Uint8ClampedArray): Uint8ClampedArray {
    const factor = getParam('contrastFactor');
    if (factor === 1.0) return data;

    const result = new Uint8ClampedArray(data.length);
    const midpoint = 128;

    for (let i = 0; i < data.length; i += 4) {
        result[i] = Math.min(255, Math.max(0, midpoint + (data[i]! - midpoint) * factor));
        result[i + 1] = Math.min(255, Math.max(0, midpoint + (data[i + 1]! - midpoint) * factor));
        result[i + 2] = Math.min(255, Math.max(0, midpoint + (data[i + 2]! - midpoint) * factor));
        result[i + 3] = data[i + 3]!;
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE LOADING
// ═══════════════════════════════════════════════════════════════════════════════

async function loadTemplates(): Promise<void> {
    if (templateCache.size > 0) return;

    const itemsPath = path.join(__dirname, '../data/items.json');
    if (!fs.existsSync(itemsPath)) {
        console.error('❌ Items data not found at:', itemsPath);
        return;
    }

    const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

    for (const item of itemsData.items || []) {
        if (!item.image) continue;

        const imagePath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            const dominantColor = getDominantColor({
                data: imageData.data,
                width: img.width,
                height: img.height
            });

            const templateData: TemplateData = {
                id: item.id,
                name: item.name,
                rarity: item.rarity || 'common',
                canvas,
                ctx,
                width: img.width,
                height: img.height,
                dominantColor,
            };

            templateCache.set(item.id, templateData);

            // Index by rarity
            if (!templatesByRarity.has(item.rarity)) {
                templatesByRarity.set(item.rarity, []);
            }
            templatesByRarity.get(item.rarity)!.push(templateData);

            // Index by color
            if (!templatesByColor.has(dominantColor)) {
                templatesByColor.set(dominantColor, []);
            }
            templatesByColor.get(dominantColor)!.push(templateData);

        } catch (err) {
            // Skip invalid images
        }
    }

    console.log(`📦 Loaded ${templateCache.size} templates`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CASE LOADING
// ═══════════════════════════════════════════════════════════════════════════════

function loadTestCases(): TestCase[] {
    const gtPath = path.join(__dirname, 'test-images/gameplay/ground-truth.json');

    if (!fs.existsSync(gtPath)) {
        console.warn('⚠️  Ground truth not found. Creating sample...');
        createSampleGroundTruth();
    }

    if (!fs.existsSync(gtPath)) {
        console.error('❌ Cannot load test cases');
        return [];
    }

    const gtData = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
    const testCases: TestCase[] = [];

    for (const [filename, data] of Object.entries(gtData)) {
        if (filename.startsWith('_')) continue; // Skip metadata

        const imagePath = path.join(__dirname, 'test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) {
            console.warn(`⚠️  Image not found: ${filename}`);
            continue;
        }

        testCases.push({
            name: filename,
            imagePath,
            groundTruth: data as GroundTruth,
            resolution: (data as any).resolution || 'unknown',
        });
    }

    return testCases;
}

function createSampleGroundTruth(): void {
    const gtDir = path.join(__dirname, 'test-images/gameplay');
    if (!fs.existsSync(gtDir)) {
        fs.mkdirSync(gtDir, { recursive: true });
    }

    const sampleGT = {
        _metadata: {
            version: '1.0',
            created: new Date().toISOString(),
            description: 'Ground truth for CV accuracy testing',
            instructions: [
                'Add screenshot files to this directory',
                'Update this JSON with item names visible in each screenshot',
                'Items should be listed by their exact display name'
            ]
        },
        'sample_720p.jpg': {
            resolution: '720p',
            items: ['Wrench', 'Battery', 'Medkit'],
            character: 'Tank',
            weapon: 'Shotgun'
        },
        'sample_1080p.jpg': {
            resolution: '1080p',
            items: ['Gym Sauce', 'Wrench', 'Battery', 'Scrap', 'Scrap'],
            character: 'Engineer',
            weapon: 'SMG'
        }
    };

    const gtPath = path.join(gtDir, 'ground-truth.json');
    fs.writeFileSync(gtPath, JSON.stringify(sampleGT, null, 2));
    console.log('📝 Created sample ground-truth.json');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION PIPELINE (parameterized)
// ═══════════════════════════════════════════════════════════════════════════════

interface Detection {
    itemId: string;
    itemName: string;
    confidence: number;
    x: number;
    y: number;
}

async function runDetection(imagePath: string): Promise<Detection[]> {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const detections: Detection[] = [];
    const stepSize = getParam('slidingWindowStep');
    const minConfidence = getParam('minConfidence');
    const lowDetailThreshold = getParam('lowDetailVarianceThreshold');
    const iconRegionPct = getParam('iconRegionPercent') / 100;
    const templateMarginPct = getParam('templateMarginPercent') / 100;

    // Determine icon size based on resolution
    const iconSize = Math.round(48 * (image.height / 1080));

    // Scan hotbar region (bottom 20%)
    const startY = Math.floor(image.height * 0.8);

    for (let y = startY; y <= image.height - iconSize; y += stepSize) {
        for (let x = 0; x <= image.width - iconSize; x += stepSize) {
            const cellData = ctx.getImageData(x, y, iconSize, iconSize);

            // Skip empty cells
            if (isEmptyCell({ data: cellData.data, width: iconSize, height: iconSize })) {
                continue;
            }

            // Skip low-detail regions
            const variance = calculateVariance({ data: cellData.data, width: iconSize, height: iconSize });
            if (variance < lowDetailThreshold) {
                continue;
            }

            // Extract center region (exclude border/count)
            const margin = Math.round(iconSize * (1 - iconRegionPct) / 2);
            const regionSize = iconSize - margin * 2;
            const regionData = ctx.getImageData(x + margin, y + margin, regionSize, regionSize);

            // Apply preprocessing
            const processedCell = enhanceContrast(regionData.data);

            // Color-based pre-filtering
            const cellColor = getDominantColor({ data: processedCell, width: regionSize, height: regionSize });
            const candidates = [
                ...(templatesByColor.get(cellColor) || []),
                ...(templatesByColor.get('mixed') || [])
            ];

            const templatesToCheck = candidates.length > 0 ? candidates : Array.from(templateCache.values()).slice(0, 30);

            // Find best match
            let bestMatch: { template: TemplateData; similarity: number } | null = null;

            for (const template of templatesToCheck) {
                // Resize template to match cell
                const tMargin = Math.round(template.width * templateMarginPct);
                const tSize = template.width - tMargin * 2;

                const tempCanvas = createCanvas(regionSize, regionSize);
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(
                    template.canvas,
                    tMargin, tMargin, tSize, tSize,
                    0, 0, regionSize, regionSize
                );
                const templateImageData = tempCtx.getImageData(0, 0, regionSize, regionSize);
                const processedTemplate = enhanceContrast(templateImageData.data);

                const similarity = calculateSimilarity(processedCell, processedTemplate);

                if (similarity >= minConfidence && (!bestMatch || similarity > bestMatch.similarity)) {
                    bestMatch = { template, similarity };
                }
            }

            if (bestMatch) {
                // Apply context boosting
                let boostedConfidence = bestMatch.similarity;

                if (bestMatch.template.rarity === 'common') {
                    boostedConfidence += getParam('contextBoostCommon');
                } else if (bestMatch.template.rarity === 'uncommon') {
                    boostedConfidence += getParam('contextBoostCommon') * 0.67;
                }

                boostedConfidence = Math.min(0.99, boostedConfidence);

                detections.push({
                    itemId: bestMatch.template.id,
                    itemName: bestMatch.template.name,
                    confidence: boostedConfidence,
                    x, y
                });
            }
        }
    }

    // Apply NMS
    return applyNMS(detections);
}

function applyNMS(detections: Detection[]): Detection[] {
    if (detections.length === 0) return [];

    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept: Detection[] = [];
    const iouThreshold = getParam('nmsIouThreshold');
    const iconSize = 48; // Approximate

    for (const det of sorted) {
        let shouldKeep = true;

        for (const keptDet of kept) {
            // Calculate IoU
            const x1 = Math.max(det.x, keptDet.x);
            const y1 = Math.max(det.y, keptDet.y);
            const x2 = Math.min(det.x + iconSize, keptDet.x + iconSize);
            const y2 = Math.min(det.y + iconSize, keptDet.y + iconSize);

            const interW = Math.max(0, x2 - x1);
            const interH = Math.max(0, y2 - y1);
            const interArea = interW * interH;

            const unionArea = iconSize * iconSize * 2 - interArea;
            const iou = interArea / unionArea;

            if (iou > iouThreshold) {
                shouldKeep = false;
                break;
            }
        }

        if (shouldKeep) {
            kept.push(det);
        }
    }

    return kept;
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

interface Metrics {
    f1: number;
    precision: number;
    recall: number;
    tp: number;
    fp: number;
    fn: number;
    avgConfidence: number;
}

function calculateMetrics(detections: Detection[], groundTruth: GroundTruth): Metrics {
    // Count detected items
    const detectedCounts = new Map<string, number>();
    let totalConfidence = 0;

    for (const det of detections) {
        const normalizedName = det.itemName.toLowerCase();
        detectedCounts.set(normalizedName, (detectedCounts.get(normalizedName) || 0) + 1);
        totalConfidence += det.confidence;
    }

    // Count ground truth items
    const truthCounts = new Map<string, number>();
    for (const item of groundTruth.items) {
        const normalizedName = item.toLowerCase();
        truthCounts.set(normalizedName, (truthCounts.get(normalizedName) || 0) + 1);
    }

    // Calculate TP, FP, FN
    let tp = 0, fp = 0, fn = 0;

    detectedCounts.forEach((count, name) => {
        const truthCount = truthCounts.get(name) || 0;
        tp += Math.min(count, truthCount);
        if (count > truthCount) fp += count - truthCount;
    });

    truthCounts.forEach((count, name) => {
        const detectedCount = detectedCounts.get(name) || 0;
        if (detectedCount < count) fn += count - detectedCount;
    });

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    const avgConfidence = detections.length > 0 ? totalConfidence / detections.length : 0;

    return { f1, precision, recall, tp, fp, fn, avgConfidence };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runTestWithParams(testCases: TestCase[]): Promise<Metrics & { timeMs: number }> {
    const startTime = performance.now();
    let totalF1 = 0, totalPrecision = 0, totalRecall = 0;
    let totalTP = 0, totalFP = 0, totalFN = 0, totalAvgConf = 0;

    for (const tc of testCases) {
        try {
            const detections = await runDetection(tc.imagePath);
            const metrics = calculateMetrics(detections, tc.groundTruth);

            totalF1 += metrics.f1;
            totalPrecision += metrics.precision;
            totalRecall += metrics.recall;
            totalTP += metrics.tp;
            totalFP += metrics.fp;
            totalFN += metrics.fn;
            totalAvgConf += metrics.avgConfidence;
        } catch (err) {
            // Test case failed, count as 0
        }
    }

    const n = testCases.length || 1;
    const timeMs = performance.now() - startTime;

    return {
        f1: totalF1 / n,
        precision: totalPrecision / n,
        recall: totalRecall / n,
        tp: totalTP,
        fp: totalFP,
        fn: totalFN,
        avgConfidence: totalAvgConf / n,
        timeMs,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARAMETER OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════════

async function testParameter(
    param: Parameter,
    testCases: TestCase[],
    baselineF1: number
): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const value of param.testValues) {
        // Set this parameter value
        setParam(param.name, value);

        // Run tests
        const metrics = await runTestWithParams(testCases);

        results.push({
            parameter: param.name,
            value,
            f1Score: metrics.f1,
            precision: metrics.precision,
            recall: metrics.recall,
            truePositives: metrics.tp,
            falsePositives: metrics.fp,
            falseNegatives: metrics.fn,
            avgConfidence: metrics.avgConfidence,
            processingTimeMs: metrics.timeMs,
            deltaFromBaseline: metrics.f1 - baselineF1,
            percentImprovement: baselineF1 > 0 ? ((metrics.f1 - baselineF1) / baselineF1) * 100 : 0,
        });

        // Reset to baseline
        setParam(param.name, param.baseline);
    }

    return results;
}

async function runSensitivityAnalysis(
    testCases: TestCase[]
): Promise<SensitivityAnalysis[]> {
    const analyses: SensitivityAnalysis[] = [];

    // Get baseline performance
    resetToBaseline();
    const baselineMetrics = await runTestWithParams(testCases);
    const baselineF1 = baselineMetrics.f1;

    console.log(`\n📊 Baseline F1: ${(baselineF1 * 100).toFixed(2)}%\n`);

    // Test each parameter
    for (const param of PARAMETERS) {
        process.stdout.write(`  Testing ${param.name}... `);

        const results = await testParameter(param, testCases, baselineF1);

        // Calculate statistics
        const f1Values = results.map(r => r.f1Score);
        const maxF1 = Math.max(...f1Values);
        const minF1 = Math.min(...f1Values);
        const f1Range = maxF1 - minF1;

        // Calculate standard deviation (impact score)
        const mean = f1Values.reduce((a, b) => a + b, 0) / f1Values.length;
        const variance = f1Values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / f1Values.length;
        const stdDev = Math.sqrt(variance);

        // Find optimal value
        const optimalResult = results.reduce((best, r) => r.f1Score > best.f1Score ? r : best);

        // Generate recommendation
        let recommendation = '';
        if (optimalResult.value === param.baseline) {
            recommendation = 'Baseline is optimal';
        } else if (optimalResult.percentImprovement > 5) {
            recommendation = `Change to ${optimalResult.value} for +${optimalResult.percentImprovement.toFixed(1)}% improvement`;
        } else if (optimalResult.percentImprovement > 0) {
            recommendation = `Minor improvement with ${optimalResult.value} (+${optimalResult.percentImprovement.toFixed(1)}%)`;
        } else {
            recommendation = 'No improvement found';
        }

        analyses.push({
            parameter: param.name,
            category: param.category,
            impactScore: stdDev,
            optimalValue: optimalResult.value,
            baselineValue: param.baseline,
            maxF1,
            minF1,
            f1Range,
            recommendation,
            rank: 0, // Will be set later
        });

        console.log(`done (impact: ${(stdDev * 100).toFixed(2)})`);
    }

    // Rank by impact score
    analyses.sort((a, b) => b.impactScore - a.impactScore);
    analyses.forEach((a, i) => a.rank = i + 1);

    return analyses;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateCSV(allResults: TestResult[]): string {
    const headers = [
        'parameter', 'value', 'f1_score', 'precision', 'recall',
        'true_positives', 'false_positives', 'false_negatives',
        'avg_confidence', 'processing_time_ms', 'delta_from_baseline', 'percent_improvement'
    ];

    const rows = allResults.map(r => [
        r.parameter,
        r.value.toString(),
        r.f1Score.toFixed(4),
        r.precision.toFixed(4),
        r.recall.toFixed(4),
        r.truePositives.toString(),
        r.falsePositives.toString(),
        r.falseNegatives.toString(),
        r.avgConfidence.toFixed(4),
        r.processingTimeMs.toFixed(0),
        r.deltaFromBaseline.toFixed(4),
        r.percentImprovement.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateSensitivityCSV(analyses: SensitivityAnalysis[]): string {
    const headers = [
        'rank', 'parameter', 'category', 'impact_score', 'optimal_value',
        'baseline_value', 'max_f1', 'min_f1', 'f1_range', 'recommendation'
    ];

    const rows = analyses.map(a => [
        a.rank.toString(),
        a.parameter,
        a.category,
        a.impactScore.toFixed(4),
        a.optimalValue.toString(),
        a.baselineValue.toString(),
        a.maxF1.toFixed(4),
        a.minF1.toFixed(4),
        a.f1Range.toFixed(4),
        `"${a.recommendation}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateChartData(allResults: TestResult[]): object {
    // Group by parameter for easy charting
    const byParameter: Record<string, { values: number[]; f1Scores: number[]; baseline: number }> = {};

    for (const r of allResults) {
        if (!byParameter[r.parameter]) {
            const param = PARAMETERS.find(p => p.name === r.parameter);
            byParameter[r.parameter] = {
                values: [],
                f1Scores: [],
                baseline: param?.baseline ?? 0,
            };
        }
        byParameter[r.parameter].values.push(r.value);
        byParameter[r.parameter].f1Scores.push(r.f1Score);
    }

    return {
        metadata: {
            generated: new Date().toISOString(),
            totalParameters: PARAMETERS.length,
            totalTests: allResults.length,
        },
        parameters: PARAMETERS.map(p => ({
            name: p.name,
            description: p.description,
            category: p.category,
            baseline: p.baseline,
            unit: p.unit,
        })),
        results: byParameter,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║            SCIENTIFIC CV PARAMETER OPTIMIZER                              ║');
    console.log('║            Systematically test all CV variables                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

    // Load templates
    await loadTemplates();

    // Load test cases
    const testCases = loadTestCases();
    console.log(`📁 Loaded ${testCases.length} test cases\n`);

    if (testCases.length === 0) {
        console.log('⚠️  No test cases available.');
        console.log('   Add gameplay screenshots to: tests/test-images/gameplay/');
        console.log('   Update ground-truth.json with expected items.\n');
        return;
    }

    // Run sensitivity analysis
    console.log('🔬 Running sensitivity analysis for all parameters...');
    console.log('   This tests each parameter across its full range.\n');

    const analyses = await runSensitivityAnalysis(testCases);

    // Collect all individual test results
    const allResults: TestResult[] = [];

    resetToBaseline();
    const baselineMetrics = await runTestWithParams(testCases);

    for (const param of PARAMETERS) {
        const results = await testParameter(param, testCases, baselineMetrics.f1);
        allResults.push(...results);
    }

    // Generate outputs
    const outputDir = path.join(__dirname, 'cv-optimization-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Write CSV files
    const detailedCSV = generateCSV(allResults);
    fs.writeFileSync(path.join(outputDir, `detailed-results-${timestamp}.csv`), detailedCSV);

    const sensitivityCSV = generateSensitivityCSV(analyses);
    fs.writeFileSync(path.join(outputDir, `sensitivity-analysis-${timestamp}.csv`), sensitivityCSV);

    // Write JSON for charts
    const chartData = generateChartData(allResults);
    fs.writeFileSync(
        path.join(outputDir, `chart-data-${timestamp}.json`),
        JSON.stringify(chartData, null, 2)
    );

    // Write optimal configuration
    const optimalConfig: Record<string, number> = {};
    analyses.forEach(a => {
        optimalConfig[a.parameter] = a.optimalValue;
    });
    fs.writeFileSync(
        path.join(outputDir, `optimal-config-${timestamp}.json`),
        JSON.stringify(optimalConfig, null, 2)
    );

    // Print summary
    console.log('\n' + '═'.repeat(75));
    console.log('SENSITIVITY ANALYSIS RESULTS');
    console.log('═'.repeat(75));
    console.log('\nTop 10 Most Impactful Parameters:');
    console.log('─'.repeat(75));
    console.log(`| ${'Rank'.padEnd(4)} | ${'Parameter'.padEnd(28)} | ${'Category'.padEnd(13)} | ${'Impact'.padEnd(8)} | ${'Optimal'.padEnd(8)} |`);
    console.log('─'.repeat(75));

    analyses.slice(0, 10).forEach(a => {
        console.log(`| ${String(a.rank).padEnd(4)} | ${a.parameter.padEnd(28)} | ${a.category.padEnd(13)} | ${(a.impactScore * 100).toFixed(2).padStart(6)}% | ${String(a.optimalValue).padEnd(8)} |`);
    });
    console.log('─'.repeat(75));

    console.log('\nRecommendations:');
    analyses.slice(0, 5).forEach(a => {
        if (a.optimalValue !== a.baselineValue) {
            console.log(`  • ${a.parameter}: ${a.recommendation}`);
        }
    });

    console.log('\n📊 Output files written to:', outputDir);
    console.log(`   • detailed-results-${timestamp}.csv`);
    console.log(`   • sensitivity-analysis-${timestamp}.csv`);
    console.log(`   • chart-data-${timestamp}.json`);
    console.log(`   • optimal-config-${timestamp}.json`);

    // Find combined optimal configuration
    console.log('\n' + '═'.repeat(75));
    console.log('TESTING COMBINED OPTIMAL CONFIGURATION');
    console.log('═'.repeat(75));

    // Apply all optimal values
    analyses.forEach(a => setParam(a.parameter, a.optimalValue));

    const optimizedMetrics = await runTestWithParams(testCases);
    const improvement = ((optimizedMetrics.f1 - baselineMetrics.f1) / baselineMetrics.f1) * 100;

    console.log(`\nBaseline F1:   ${(baselineMetrics.f1 * 100).toFixed(2)}%`);
    console.log(`Optimized F1:  ${(optimizedMetrics.f1 * 100).toFixed(2)}%`);
    console.log(`Improvement:   ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%`);

    if (improvement > 0) {
        console.log('\n✅ Optimization successful! Apply the optimal config to production.');
    } else {
        console.log('\n⚠️  Combined optimization did not improve results.');
        console.log('   Individual parameters may interact negatively.');
        console.log('   Consider applying only the top improvements.');
    }
}

// Run if executed directly
main().catch(console.error);

// Export for use as module
export {
    PARAMETERS,
    Parameter,
    TestResult,
    SensitivityAnalysis,
    runSensitivityAnalysis,
    generateCSV,
    generateChartData,
};
