#!/usr/bin/env node
// ========================================
// Scientific CV Parameter Experiment Runner
// ========================================
// Systematically tests parameter variations one at a time
// Records F1 scores and timing for each configuration
// ========================================

import * as fs from 'fs';
import * as path from 'path';

// Try to load canvas module
let createCanvas: any;
let loadImage: any;
let NodeImageData: any;

try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    NodeImageData = canvas.ImageData;
    globalThis.ImageData = NodeImageData as any;
} catch (error) {
    console.error('Canvas module required. Run: npm install canvas');
    process.exit(1);
}

// ========================================
// TUNABLE PARAMETERS - These are the knobs we're testing
// ========================================

interface ExperimentConfig {
    // Detection threshold - minimum confidence to count as a match
    testThreshold: number;

    // Center extraction margin - how much edge to ignore (0-0.4)
    centerMargin: number;

    // Histogram bins for color comparison (4-32)
    histogramBins: number;

    // Rarity detection boost (1.0-1.5)
    rarityBoost: number;

    // Agreement bonus threshold for multi-method scoring (0.05-0.2)
    agreementThreshold: number;

    // Empty cell variance threshold (100-800)
    emptyVarianceThreshold: number;

    // Border pixels for rarity detection (1-6)
    borderPixels: number;

    // Edge sampling step (1-4)
    edgeSampleStep: number;
}

// Baseline configuration
const BASELINE: ExperimentConfig = {
    testThreshold: 0.45,
    centerMargin: 0.15,
    histogramBins: 16,
    rarityBoost: 1.15,
    agreementThreshold: 0.1,
    emptyVarianceThreshold: 300,
    borderPixels: 3,
    edgeSampleStep: 2,
};

// Parameter variations to test (one at a time)
const EXPERIMENTS: Record<string, number[]> = {
    testThreshold: [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
    centerMargin: [0.05, 0.10, 0.15, 0.20, 0.25, 0.30],
    histogramBins: [8, 12, 16, 20, 24, 32],
    rarityBoost: [1.0, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30],
    agreementThreshold: [0.05, 0.08, 0.10, 0.12, 0.15, 0.20],
    emptyVarianceThreshold: [100, 200, 300, 400, 500, 600],
    borderPixels: [1, 2, 3, 4, 5],
    edgeSampleStep: [1, 2, 3, 4],
};

// ========================================
// Types
// ========================================

interface GameItem {
    id: string;
    name: string;
    image?: string;
    rarity: string;
}

interface TemplateData {
    item: GameItem;
    canvas: any;
    ctx: any;
    width: number;
    height: number;
}

interface TestCase {
    name: string;
    imagePath: string;
    groundTruth: Array<{ id: string; name: string; count: number }>;
}

interface ExperimentResult {
    parameter: string;
    value: number;
    avgF1: number;
    avgTime: number;
    testResults: Array<{
        testCase: string;
        f1: number;
        precision: number;
        recall: number;
        time: number;
        detections: number;
        expected: number;
    }>;
}

// ========================================
// Global state
// ========================================

const templateCache = new Map<string, TemplateData>();
const templatesByRarity = new Map<string, TemplateData[]>();
let itemsData: { items: GameItem[] } | null = null;

const RARITY_COLORS: Record<string, { r: [number, number]; g: [number, number]; b: [number, number] }> = {
    common: { r: [100, 180], g: [100, 180], b: [100, 180] },
    uncommon: { r: [0, 100], g: [150, 255], b: [0, 100] },
    rare: { r: [0, 100], g: [100, 200], b: [200, 255] },
    epic: { r: [150, 255], g: [0, 100], b: [200, 255] },
    legendary: { r: [200, 255], g: [100, 200], b: [0, 100] },
};

// ========================================
// Core functions
// ========================================

async function loadTemplates(): Promise<void> {
    if (templateCache.size > 0) return;

    const itemsPath = path.join(__dirname, '../data/items.json');
    if (!fs.existsSync(itemsPath)) {
        console.warn('items.json not found');
        return;
    }

    itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    const items = itemsData?.items || [];

    for (const item of items) {
        if (!item.image) continue;

        try {
            const imagePath = path.join(__dirname, '../src/', item.image);
            if (!fs.existsSync(imagePath)) continue;

            const img = await loadImage(imagePath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const templateData = { item, canvas, ctx, width: img.width, height: img.height };
            templateCache.set(item.id, templateData);

            if (!templatesByRarity.has(item.rarity)) {
                templatesByRarity.set(item.rarity, []);
            }
            templatesByRarity.get(item.rarity)!.push(templateData);
        } catch {
            // Skip failed templates
        }
    }
}

function loadTestCases(): TestCase[] {
    const groundTruthPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
    const groundTruthData = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

    return Object.entries(groundTruthData)
        .filter(([name]) => !name.startsWith('_'))
        .map(([name, data]: [string, any]) => {
            const imagePath = path.join(__dirname, '../test-images/gameplay', name);
            if (!fs.existsSync(imagePath)) return null;

            const rawItems = data.items || [];
            const itemCounts = new Map<string, number>();
            for (const item of rawItems) {
                itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
            }

            return {
                name,
                imagePath,
                groundTruth: Array.from(itemCounts.entries()).map(([name, count]) => ({
                    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    name,
                    count,
                })),
            };
        })
        .filter((tc): tc is TestCase => tc !== null);
}

function detectGridPositions(width: number, height: number): Array<{ x: number; y: number; width: number; height: number }> {
    const iconSize = Math.round(40 * (height / 720));
    const spacing = Math.round(4 * (height / 720));
    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];

    const rowHeight = iconSize + spacing;
    const bottomMargin = Math.round(20 * (height / 720));

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * 0.20);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.75) break;

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

function isEmptyCell(imageData: any, config: ExperimentConfig): boolean {
    const pixels = imageData.data;
    let sum = 0, sumSq = 0, count = 0;
    let sumR = 0, sumG = 0, sumB = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const gray = (r + g + b) / 3;

        sum += gray;
        sumSq += gray * gray;
        sumR += r;
        sumG += g;
        sumB += b;
        count++;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    if (variance < config.emptyVarianceThreshold) return true;
    if (mean < 40) return true;

    const maxChannel = Math.max(avgR, avgG, avgB);
    const minChannel = Math.min(avgR, avgG, avgB);
    const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
    if (saturation > 0.5 && variance < 800) return true;

    return false;
}

function detectRarityFromBorder(imageData: any, config: ExperimentConfig): string | null {
    const { width, height, data } = imageData;
    const borderPixels = config.borderPixels;

    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < borderPixels; y++) {
            const idx = (y * width + x) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
        }
    }

    for (let y = borderPixels; y < height; y++) {
        for (let x = 0; x < borderPixels; x++) {
            const idx = (y * width + x) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
        }
    }

    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;

    let bestRarity: string | null = null;
    let bestScore = 0;

    for (const [rarity, ranges] of Object.entries(RARITY_COLORS)) {
        const rInRange = avgR >= ranges.r[0] && avgR <= ranges.r[1];
        const gInRange = avgG >= ranges.g[0] && avgG <= ranges.g[1];
        const bInRange = avgB >= ranges.b[0] && avgB <= ranges.b[1];
        const score = (rInRange ? 1 : 0) + (gInRange ? 1 : 0) + (bInRange ? 1 : 0);

        if (score > bestScore) {
            bestScore = score;
            bestRarity = rarity;
        }
    }

    return bestScore >= 2 ? bestRarity : null;
}

function calculateNCC(imageData1: any, imageData2: any): number {
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

function calculateHistogramSimilarity(imageData1: any, imageData2: any, config: ExperimentConfig): number {
    const bins = config.histogramBins;
    const binSize = 256 / bins;

    const hist1 = new Array(bins * bins * bins).fill(0);
    const hist2 = new Array(bins * bins * bins).fill(0);

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    let count1 = 0, count2 = 0;

    for (let i = 0; i < pixels1.length; i += 4) {
        const rBin = Math.min(bins - 1, Math.floor(pixels1[i] / binSize));
        const gBin = Math.min(bins - 1, Math.floor(pixels1[i + 1] / binSize));
        const bBin = Math.min(bins - 1, Math.floor(pixels1[i + 2] / binSize));
        const idx = rBin * bins * bins + gBin * bins + bBin;
        hist1[idx]++;
        count1++;
    }

    for (let i = 0; i < pixels2.length; i += 4) {
        const rBin = Math.min(bins - 1, Math.floor(pixels2[i] / binSize));
        const gBin = Math.min(bins - 1, Math.floor(pixels2[i + 1] / binSize));
        const bBin = Math.min(bins - 1, Math.floor(pixels2[i + 2] / binSize));
        const idx = rBin * bins * bins + gBin * bins + bBin;
        hist2[idx]++;
        count2++;
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

function calculateEdgeSimilarity(imageData1: any, imageData2: any, config: ExperimentConfig): number {
    const { width: w1, height: h1 } = imageData1;
    const { width: w2, height: h2 } = imageData2;

    if (w1 !== w2 || h1 !== h2) return 0;

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    const getGray = (pixels: any, x: number, y: number, width: number): number => {
        const idx = (y * width + x) * 4;
        return (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
    };

    const getEdge = (pixels: any, x: number, y: number, width: number, height: number): number => {
        if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) return 0;
        const gx = getGray(pixels, x + 1, y, width) - getGray(pixels, x - 1, y, width);
        const gy = getGray(pixels, x, y + 1, width) - getGray(pixels, x, y - 1, width);
        return Math.sqrt(gx * gx + gy * gy);
    };

    let sumProduct = 0, sumSq1 = 0, sumSq2 = 0;
    const step = config.edgeSampleStep;

    for (let y = 1; y < h1 - 1; y += step) {
        for (let x = 1; x < w1 - 1; x += step) {
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

function calculateCombinedSimilarity(imageData1: any, imageData2: any, config: ExperimentConfig): number {
    const ncc = calculateNCC(imageData1, imageData2);
    const histogram = calculateHistogramSimilarity(imageData1, imageData2, config);
    const edges = calculateEdgeSimilarity(imageData1, imageData2, config);

    const maxScore = Math.max(ncc, histogram, edges);

    let agreementBonus = 0;
    const threshold = config.agreementThreshold;
    if (Math.abs(ncc - maxScore) < threshold) agreementBonus += 0.03;
    if (Math.abs(histogram - maxScore) < threshold) agreementBonus += 0.03;
    if (Math.abs(edges - maxScore) < threshold) agreementBonus += 0.03;

    return Math.min(0.99, maxScore + agreementBonus);
}

async function findBestMatch(
    cellImageData: any,
    config: ExperimentConfig
): Promise<{ item: GameItem; confidence: number } | null> {
    const detectedRarity = detectRarityFromBorder(cellImageData, config);

    let candidates: TemplateData[];
    if (detectedRarity && templatesByRarity.has(detectedRarity)) {
        candidates = templatesByRarity.get(detectedRarity)!;
    } else {
        candidates = Array.from(templateCache.values());
    }

    let bestMatch: { item: GameItem; confidence: number } | null = null;

    const margin = Math.round(cellImageData.width * config.centerMargin);
    const centerWidth = cellImageData.width - margin * 2;
    const centerHeight = cellImageData.height - margin * 2;

    if (centerWidth <= 0 || centerHeight <= 0) return null;

    const centerCanvas = createCanvas(centerWidth, centerHeight);
    const centerCtx = centerCanvas.getContext('2d');
    const centerData = centerCtx.createImageData(centerWidth, centerHeight);

    for (let y = 0; y < centerHeight; y++) {
        for (let x = 0; x < centerWidth; x++) {
            const srcIdx = ((y + margin) * cellImageData.width + (x + margin)) * 4;
            const dstIdx = (y * centerWidth + x) * 4;
            centerData.data[dstIdx] = cellImageData.data[srcIdx];
            centerData.data[dstIdx + 1] = cellImageData.data[srcIdx + 1];
            centerData.data[dstIdx + 2] = cellImageData.data[srcIdx + 2];
            centerData.data[dstIdx + 3] = cellImageData.data[srcIdx + 3];
        }
    }

    for (const template of candidates) {
        const resizedCanvas = createCanvas(centerWidth, centerHeight);
        const resizedCtx = resizedCanvas.getContext('2d');
        const tMargin = Math.round(template.width * config.centerMargin);
        resizedCtx.drawImage(
            template.canvas,
            tMargin, tMargin,
            template.width - tMargin * 2, template.height - tMargin * 2,
            0, 0,
            centerWidth, centerHeight
        );
        const templateData = resizedCtx.getImageData(0, 0, centerWidth, centerHeight);

        let similarity = calculateCombinedSimilarity(centerData, templateData, config);

        if (detectedRarity && template.item.rarity === detectedRarity) {
            similarity *= config.rarityBoost;
        }

        similarity = Math.min(0.99, similarity);

        if (!bestMatch || similarity > bestMatch.confidence) {
            bestMatch = { item: template.item, confidence: similarity };
        }
    }

    return bestMatch;
}

async function runDetection(
    ctx: any,
    width: number,
    height: number,
    config: ExperimentConfig
): Promise<Array<{ id: string; name: string; confidence: number }>> {
    await loadTemplates();

    const gridPositions = detectGridPositions(width, height);
    const detections: Array<{ id: string; name: string; confidence: number }> = [];

    for (const cell of gridPositions) {
        const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

        if (isEmptyCell(cellImageData, config)) continue;

        const match = await findBestMatch(cellImageData, config);

        if (match && match.confidence >= config.testThreshold) {
            detections.push({
                id: match.item.id,
                name: match.item.name,
                confidence: match.confidence,
            });
        }
    }

    return detections;
}

function calculateMetrics(
    detections: Array<{ id: string; name: string; confidence: number }>,
    groundTruth: Array<{ id: string; name: string; count: number }>
): { precision: number; recall: number; f1: number } {
    const detectedItems = new Map<string, number>();
    detections.forEach(d => {
        detectedItems.set(d.id, (detectedItems.get(d.id) || 0) + 1);
    });

    const truthItems = new Map<string, number>();
    groundTruth.forEach(item => {
        truthItems.set(item.id, item.count);
    });

    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    detectedItems.forEach((detectedCount, itemId) => {
        const truthCount = truthItems.get(itemId) || 0;
        truePositives += Math.min(detectedCount, truthCount);
        if (detectedCount > truthCount) {
            falsePositives += detectedCount - truthCount;
        }
    });

    truthItems.forEach((truthCount, itemId) => {
        const detectedCount = detectedItems.get(itemId) || 0;
        if (detectedCount < truthCount) {
            falseNegatives += truthCount - detectedCount;
        }
    });

    const precision = truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 0;

    const recall = truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 0;

    const f1 = precision + recall > 0
        ? 2 * (precision * recall) / (precision + recall)
        : 0;

    return { precision, recall, f1 };
}

async function runExperiment(
    testCases: TestCase[],
    config: ExperimentConfig
): Promise<ExperimentResult['testResults']> {
    const results: ExperimentResult['testResults'] = [];

    for (const tc of testCases) {
        const image = await loadImage(tc.imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const startTime = performance.now();
        const detections = await runDetection(ctx, image.width, image.height, config);
        const time = performance.now() - startTime;

        const metrics = calculateMetrics(detections, tc.groundTruth);
        const expected = tc.groundTruth.reduce((sum, item) => sum + item.count, 0);

        results.push({
            testCase: tc.name,
            f1: metrics.f1,
            precision: metrics.precision,
            recall: metrics.recall,
            time,
            detections: detections.length,
            expected,
        });
    }

    return results;
}

// ========================================
// Main experiment runner
// ========================================

async function main() {
    const args = process.argv.slice(2);
    const paramToTest = args[0];

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Scientific CV Parameter Experiment Runner                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    // Load test cases
    const testCases = loadTestCases();
    console.log(`Loaded ${testCases.length} test cases\n`);

    // Load templates
    await loadTemplates();
    console.log(`Loaded ${templateCache.size} templates\n`);

    // If a specific parameter is provided, only test that one
    const paramsToRun = paramToTest && EXPERIMENTS[paramToTest]
        ? [paramToTest]
        : Object.keys(EXPERIMENTS);

    const allResults: ExperimentResult[] = [];

    for (const paramName of paramsToRun) {
        const values = EXPERIMENTS[paramName];

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing parameter: ${paramName}`);
        console.log(`Values: ${values.join(', ')}`);
        console.log(`Baseline: ${BASELINE[paramName as keyof ExperimentConfig]}`);
        console.log(`${'='.repeat(60)}\n`);

        console.log(`| ${'Value'.padEnd(10)} | ${'Avg F1'.padEnd(10)} | ${'Avg Time'.padEnd(10)} | Change |`);
        console.log(`|${'-'.repeat(12)}|${'-'.repeat(12)}|${'-'.repeat(12)}|--------|`);

        let baselineF1 = 0;

        for (const value of values) {
            // Create config with this parameter variation
            const config: ExperimentConfig = { ...BASELINE, [paramName]: value };

            const testResults = await runExperiment(testCases, config);

            const avgF1 = testResults.reduce((sum, r) => sum + r.f1, 0) / testResults.length;
            const avgTime = testResults.reduce((sum, r) => sum + r.time, 0) / testResults.length;

            if (value === BASELINE[paramName as keyof ExperimentConfig]) {
                baselineF1 = avgF1;
            }

            const change = baselineF1 > 0
                ? ((avgF1 - baselineF1) / baselineF1 * 100).toFixed(1)
                : '---';
            const changeStr = baselineF1 > 0 && avgF1 > baselineF1 ? `+${change}%` : `${change}%`;

            const isBaseline = value === BASELINE[paramName as keyof ExperimentConfig];
            const marker = isBaseline ? ' *' : '';

            console.log(`| ${String(value).padEnd(10)}${marker} | ${(avgF1 * 100).toFixed(2).padEnd(8)}% | ${avgTime.toFixed(0).padStart(6)}ms | ${changeStr.padStart(6)} |`);

            allResults.push({
                parameter: paramName,
                value,
                avgF1,
                avgTime,
                testResults,
            });
        }
    }

    // Summary: Find best value for each parameter
    console.log('\n\n' + '='.repeat(60));
    console.log('SUMMARY: Optimal Values');
    console.log('='.repeat(60));
    console.log(`| ${'Parameter'.padEnd(25)} | ${'Baseline'.padEnd(10)} | ${'Optimal'.padEnd(10)} | ${'F1 Gain'.padEnd(8)} |`);
    console.log(`|${'-'.repeat(27)}|${'-'.repeat(12)}|${'-'.repeat(12)}|${'-'.repeat(10)}|`);

    const parameterBests = new Map<string, { value: number; f1: number }>();

    for (const result of allResults) {
        const current = parameterBests.get(result.parameter);
        if (!current || result.avgF1 > current.f1) {
            parameterBests.set(result.parameter, { value: result.value, f1: result.avgF1 });
        }
    }

    for (const [param, best] of parameterBests) {
        const baseline = BASELINE[param as keyof ExperimentConfig];
        const baselineResult = allResults.find(r => r.parameter === param && r.value === baseline);
        const baselineF1 = baselineResult?.avgF1 || 0;
        const gain = baselineF1 > 0 ? ((best.f1 - baselineF1) / baselineF1 * 100).toFixed(1) : '---';
        const gainStr = best.f1 > baselineF1 ? `+${gain}%` : `${gain}%`;

        console.log(`| ${param.padEnd(25)} | ${String(baseline).padEnd(10)} | ${String(best.value).padEnd(10)} | ${gainStr.padEnd(8)} |`);
    }

    // Save results to JSON
    const outputPath = path.join(__dirname, '../test-results/experiment-results.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        baseline: BASELINE,
        results: allResults,
        bestPerParameter: Object.fromEntries(parameterBests),
    }, null, 2));

    console.log(`\n\nResults saved to: ${outputPath}`);
}

main().catch(console.error);
