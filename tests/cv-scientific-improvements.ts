#!/usr/bin/env node
// ========================================
// Scientific CV Improvements Framework
// ========================================
// Tests each improvement individually and in combination
// Records F1 scores and builds optimal configuration
// ========================================

import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch { console.error('Canvas required'); process.exit(1); }

// ========================================
// IMPROVEMENT FLAGS
// ========================================
interface ImprovementFlags {
    // Grid detection improvements
    useAdaptiveGrid: boolean;      // Detect grid via edge detection
    adjustedGridParams: boolean;   // Use tuned grid parameters for 1080p

    // Matching improvements
    multiScale: boolean;           // Try multiple scale factors
    colorNormalization: boolean;   // Normalize colors before matching
    useSSIM: boolean;              // Use structural similarity

    // Preprocessing
    contrastEnhancement: boolean;  // Enhance contrast before matching

    // Thresholds
    lowerThreshold: boolean;       // Use lower confidence threshold
}

const BASELINE_FLAGS: ImprovementFlags = {
    useAdaptiveGrid: false,
    adjustedGridParams: false,
    multiScale: false,
    colorNormalization: false,
    useSSIM: false,
    contrastEnhancement: false,
    lowerThreshold: false,
};

// ========================================
// Core types
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
    imageData: any;
    width: number;
    height: number;
}

interface TestCase {
    name: string;
    imagePath: string;
    groundTruth: Array<{ id: string; name: string; count: number }>;
    actualWidth?: number;
    actualHeight?: number;
}

// ========================================
// Global state
// ========================================
const templateCache = new Map<string, TemplateData>();
const templatesByRarity = new Map<string, TemplateData[]>();

const RARITY_COLORS: Record<string, { r: [number, number]; g: [number, number]; b: [number, number] }> = {
    common: { r: [100, 180], g: [100, 180], b: [100, 180] },
    uncommon: { r: [0, 100], g: [150, 255], b: [0, 100] },
    rare: { r: [0, 100], g: [100, 200], b: [200, 255] },
    epic: { r: [150, 255], g: [0, 100], b: [200, 255] },
    legendary: { r: [200, 255], g: [100, 200], b: [0, 100] },
};

// ========================================
// Helper functions
// ========================================

async function loadTemplates(): Promise<void> {
    if (templateCache.size > 0) return;

    const itemsPath = path.join(__dirname, '../data/items.json');
    const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            const templateData: TemplateData = {
                item, canvas, ctx, imageData,
                width: img.width, height: img.height
            };

            templateCache.set(item.id, templateData);

            if (!templatesByRarity.has(item.rarity)) {
                templatesByRarity.set(item.rarity, []);
            }
            templatesByRarity.get(item.rarity)!.push(templateData);
        } catch {}
    }

    console.log(`Loaded ${templateCache.size} templates`);
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
                    name, count,
                })),
            };
        })
        .filter((tc): tc is TestCase => tc !== null);
}

// ========================================
// IMPROVEMENT 1: Adjusted Grid Parameters
// ========================================
function detectGridPositions(
    width: number,
    height: number,
    flags: ImprovementFlags
): Array<{ x: number; y: number; width: number; height: number }> {

    let iconSize: number;
    let spacing: number;
    let bottomMargin: number;
    let sideMarginPct: number;
    let validRowThreshold: number;

    if (flags.adjustedGridParams) {
        // Tuned parameters based on actual 1080p game analysis
        // At 1080p: icons are ~60px, spacing ~6px, bottom margin ~30px
        iconSize = Math.round(60 * (height / 1080));
        spacing = Math.round(6 * (height / 1080));
        bottomMargin = Math.round(30 * (height / 1080));
        sideMarginPct = 0.15; // 15% side margin (was 20%)
        validRowThreshold = 0.70; // Allow rows down to 70% (was 75%)
    } else {
        // Original parameters
        iconSize = Math.round(40 * (height / 720));
        spacing = Math.round(4 * (height / 720));
        bottomMargin = Math.round(20 * (height / 720));
        sideMarginPct = 0.20;
        validRowThreshold = 0.75;
    }

    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const rowHeight = iconSize + spacing;

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * sideMarginPct);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * validRowThreshold) break;

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

// ========================================
// IMPROVEMENT 2: Color Normalization
// ========================================
function normalizeColors(imageData: any): any {
    const data = new Uint8ClampedArray(imageData.data);

    // Calculate min/max for each channel
    let minR = 255, maxR = 0;
    let minG = 255, maxG = 0;
    let minB = 255, maxB = 0;

    for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]);
        maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i + 1]);
        maxG = Math.max(maxG, data[i + 1]);
        minB = Math.min(minB, data[i + 2]);
        maxB = Math.max(maxB, data[i + 2]);
    }

    // Normalize to full range
    const rangeR = maxR - minR || 1;
    const rangeG = maxG - minG || 1;
    const rangeB = maxB - minB || 1;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round((data[i] - minR) / rangeR * 255);
        data[i + 1] = Math.round((data[i + 1] - minG) / rangeG * 255);
        data[i + 2] = Math.round((data[i + 2] - minB) / rangeB * 255);
    }

    return { data, width: imageData.width, height: imageData.height };
}

// ========================================
// IMPROVEMENT 3: Contrast Enhancement
// ========================================
function enhanceContrast(imageData: any, factor: number = 1.5): any {
    const data = new Uint8ClampedArray(imageData.data);
    const midpoint = 128;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, midpoint + (data[i] - midpoint) * factor));
        data[i + 1] = Math.min(255, Math.max(0, midpoint + (data[i + 1] - midpoint) * factor));
        data[i + 2] = Math.min(255, Math.max(0, midpoint + (data[i + 2] - midpoint) * factor));
    }

    return { data, width: imageData.width, height: imageData.height };
}

// ========================================
// IMPROVEMENT 4: SSIM (Structural Similarity)
// ========================================
function calculateSSIM(img1: any, img2: any): number {
    if (img1.width !== img2.width || img1.height !== img2.height) return 0;

    const data1 = img1.data;
    const data2 = img2.data;
    const n = data1.length / 4;

    // Convert to grayscale and calculate means
    let mean1 = 0, mean2 = 0;
    const gray1: number[] = [];
    const gray2: number[] = [];

    for (let i = 0; i < data1.length; i += 4) {
        const g1 = (data1[i] + data1[i+1] + data1[i+2]) / 3;
        const g2 = (data2[i] + data2[i+1] + data2[i+2]) / 3;
        gray1.push(g1);
        gray2.push(g2);
        mean1 += g1;
        mean2 += g2;
    }

    mean1 /= n;
    mean2 /= n;

    // Calculate variances and covariance
    let var1 = 0, var2 = 0, covar = 0;

    for (let i = 0; i < n; i++) {
        const d1 = gray1[i] - mean1;
        const d2 = gray2[i] - mean2;
        var1 += d1 * d1;
        var2 += d2 * d2;
        covar += d1 * d2;
    }

    var1 /= n;
    var2 /= n;
    covar /= n;

    // SSIM constants
    const C1 = (0.01 * 255) ** 2;
    const C2 = (0.03 * 255) ** 2;

    const ssim = ((2 * mean1 * mean2 + C1) * (2 * covar + C2)) /
                 ((mean1 ** 2 + mean2 ** 2 + C1) * (var1 + var2 + C2));

    return (ssim + 1) / 2; // Normalize to 0-1
}

// ========================================
// Original similarity functions
// ========================================
function calculateNCC(imageData1: any, imageData2: any): number {
    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;

    let sum1 = 0, sum2 = 0, sumProduct = 0, sumSquare1 = 0, sumSquare2 = 0, count = 0;
    const len = Math.min(pixels1.length, pixels2.length);

    for (let i = 0; i < len; i += 4) {
        const gray1 = (pixels1[i] + pixels1[i+1] + pixels1[i+2]) / 3;
        const gray2 = (pixels2[i] + pixels2[i+1] + pixels2[i+2]) / 3;
        sum1 += gray1; sum2 += gray2;
        sumProduct += gray1 * gray2;
        sumSquare1 += gray1 * gray1;
        sumSquare2 += gray2 * gray2;
        count++;
    }

    const mean1 = sum1 / count, mean2 = sum2 / count;
    const numerator = sumProduct / count - mean1 * mean2;
    const denominator = Math.sqrt((sumSquare1 / count - mean1 * mean1) * (sumSquare2 / count - mean2 * mean2));

    if (denominator === 0) return 0;
    return (numerator / denominator + 1) / 2;
}

function calculateHistogramSimilarity(imageData1: any, imageData2: any): number {
    const bins = 8;
    const binSize = 256 / bins;
    const hist1 = new Array(bins * bins * bins).fill(0);
    const hist2 = new Array(bins * bins * bins).fill(0);

    const pixels1 = imageData1.data;
    const pixels2 = imageData2.data;
    let count1 = 0, count2 = 0;

    for (let i = 0; i < pixels1.length; i += 4) {
        const idx = Math.min(bins-1, Math.floor(pixels1[i]/binSize)) * bins * bins +
                    Math.min(bins-1, Math.floor(pixels1[i+1]/binSize)) * bins +
                    Math.min(bins-1, Math.floor(pixels1[i+2]/binSize));
        hist1[idx]++; count1++;
    }

    for (let i = 0; i < pixels2.length; i += 4) {
        const idx = Math.min(bins-1, Math.floor(pixels2[i]/binSize)) * bins * bins +
                    Math.min(bins-1, Math.floor(pixels2[i+1]/binSize)) * bins +
                    Math.min(bins-1, Math.floor(pixels2[i+2]/binSize));
        hist2[idx]++; count2++;
    }

    for (let i = 0; i < hist1.length; i++) { hist1[i] /= count1; hist2[i] /= count2; }

    let intersection = 0;
    for (let i = 0; i < hist1.length; i++) intersection += Math.min(hist1[i], hist2[i]);
    return intersection;
}

// ========================================
// Combined similarity with improvements
// ========================================
function calculateSimilarity(
    cellData: any,
    templateData: any,
    flags: ImprovementFlags
): number {
    let cell = cellData;
    let template = templateData;

    // Apply preprocessing
    if (flags.colorNormalization) {
        cell = normalizeColors(cell);
        template = normalizeColors(template);
    }

    if (flags.contrastEnhancement) {
        cell = enhanceContrast(cell);
        template = enhanceContrast(template);
    }

    // Calculate similarities
    const ncc = calculateNCC(cell, template);
    const histogram = calculateHistogramSimilarity(cell, template);

    let scores = [ncc, histogram];

    if (flags.useSSIM) {
        const ssim = calculateSSIM(cell, template);
        scores.push(ssim);
    }

    // Use max score with agreement bonus
    const maxScore = Math.max(...scores);
    let agreementBonus = 0;
    const threshold = 0.1;

    for (const score of scores) {
        if (Math.abs(score - maxScore) < threshold) agreementBonus += 0.02;
    }

    return Math.min(0.99, maxScore + agreementBonus);
}

// ========================================
// Cell detection and matching
// ========================================
function isEmptyCell(imageData: any): boolean {
    const pixels = imageData.data;
    let sum = 0, sumSq = 0, count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
        sum += gray;
        sumSq += gray * gray;
        count++;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    if (variance < 300) return true;
    if (mean < 40) return true;

    return false;
}

function resizeImageData(
    ctx: any,
    sourceCanvas: any,
    targetWidth: number,
    targetHeight: number,
    margin: number = 0.15
): any {
    const srcMargin = Math.round(sourceCanvas.width * margin);
    const srcW = sourceCanvas.width - srcMargin * 2;
    const srcH = sourceCanvas.height - srcMargin * 2;

    const tempCanvas = createCanvas(targetWidth, targetHeight);
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(
        sourceCanvas,
        srcMargin, srcMargin, srcW, srcH,
        0, 0, targetWidth, targetHeight
    );

    return tempCtx.getImageData(0, 0, targetWidth, targetHeight);
}

async function findBestMatch(
    cellImageData: any,
    cellWidth: number,
    cellHeight: number,
    flags: ImprovementFlags
): Promise<{ item: GameItem; confidence: number } | null> {

    const candidates = Array.from(templateCache.values());
    let bestMatch: { item: GameItem; confidence: number } | null = null;

    // Center crop the cell
    const margin = Math.round(cellWidth * 0.15);
    const centerWidth = cellWidth - margin * 2;
    const centerHeight = cellHeight - margin * 2;

    if (centerWidth <= 0 || centerHeight <= 0) return null;

    // Extract center of cell
    const centerData = { data: new Uint8ClampedArray(centerWidth * centerHeight * 4), width: centerWidth, height: centerHeight };
    for (let y = 0; y < centerHeight; y++) {
        for (let x = 0; x < centerWidth; x++) {
            const srcIdx = ((y + margin) * cellWidth + (x + margin)) * 4;
            const dstIdx = (y * centerWidth + x) * 4;
            centerData.data[dstIdx] = cellImageData.data[srcIdx];
            centerData.data[dstIdx + 1] = cellImageData.data[srcIdx + 1];
            centerData.data[dstIdx + 2] = cellImageData.data[srcIdx + 2];
            centerData.data[dstIdx + 3] = cellImageData.data[srcIdx + 3];
        }
    }

    // Scale factors to try
    const scales = flags.multiScale ? [0.85, 1.0, 1.15] : [1.0];

    for (const template of candidates) {
        for (const scale of scales) {
            // Resize template to match cell (with scale factor)
            const targetW = Math.round(centerWidth * scale);
            const targetH = Math.round(centerHeight * scale);

            if (targetW <= 0 || targetH <= 0) continue;

            const resizedTemplate = resizeImageData(null, template.canvas, targetW, targetH);

            // For multi-scale, also resize center if needed
            let compareCell = centerData;
            if (scale !== 1.0) {
                // Create scaled version of cell center
                const scaledCell = { data: new Uint8ClampedArray(targetW * targetH * 4), width: targetW, height: targetH };
                // Simple nearest-neighbor resize
                for (let y = 0; y < targetH; y++) {
                    for (let x = 0; x < targetW; x++) {
                        const srcX = Math.floor(x / scale);
                        const srcY = Math.floor(y / scale);
                        if (srcX < centerWidth && srcY < centerHeight) {
                            const srcIdx = (srcY * centerWidth + srcX) * 4;
                            const dstIdx = (y * targetW + x) * 4;
                            scaledCell.data[dstIdx] = centerData.data[srcIdx];
                            scaledCell.data[dstIdx + 1] = centerData.data[srcIdx + 1];
                            scaledCell.data[dstIdx + 2] = centerData.data[srcIdx + 2];
                            scaledCell.data[dstIdx + 3] = centerData.data[srcIdx + 3];
                        }
                    }
                }
                compareCell = scaledCell;
            }

            const similarity = calculateSimilarity(compareCell, resizedTemplate, flags);

            if (!bestMatch || similarity > bestMatch.confidence) {
                bestMatch = { item: template.item, confidence: similarity };
            }
        }
    }

    return bestMatch;
}

// ========================================
// Main detection pipeline
// ========================================
async function runDetection(
    imagePath: string,
    flags: ImprovementFlags
): Promise<Array<{ id: string; name: string; confidence: number }>> {

    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const gridPositions = detectGridPositions(image.width, image.height, flags);
    const threshold = flags.lowerThreshold ? 0.35 : 0.45;

    const detections: Array<{ id: string; name: string; confidence: number }> = [];

    for (const cell of gridPositions) {
        const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

        if (isEmptyCell(cellImageData)) continue;

        const match = await findBestMatch(cellImageData, cell.width, cell.height, flags);

        if (match && match.confidence >= threshold) {
            detections.push({
                id: match.item.id,
                name: match.item.name,
                confidence: match.confidence,
            });
        }
    }

    return detections;
}

// ========================================
// Metrics calculation
// ========================================
function calculateMetrics(
    detections: Array<{ id: string; name: string; confidence: number }>,
    groundTruth: Array<{ id: string; name: string; count: number }>
) {
    const detectedItems = new Map<string, number>();
    detections.forEach(d => detectedItems.set(d.id, (detectedItems.get(d.id) || 0) + 1));

    const truthItems = new Map<string, number>();
    groundTruth.forEach(item => truthItems.set(item.id, item.count));

    let tp = 0, fp = 0, fn = 0;

    detectedItems.forEach((count, id) => {
        const truth = truthItems.get(id) || 0;
        tp += Math.min(count, truth);
        if (count > truth) fp += count - truth;
    });

    truthItems.forEach((count, id) => {
        const detected = detectedItems.get(id) || 0;
        if (detected < count) fn += count - detected;
    });

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    return { precision, recall, f1, tp, fp, fn };
}

// ========================================
// Test runner
// ========================================
async function runTest(
    testCases: TestCase[],
    flags: ImprovementFlags,
    label: string
): Promise<{ avgF1: number; avgTime: number }> {
    let totalF1 = 0, totalTime = 0;

    for (const tc of testCases) {
        const start = performance.now();
        const detections = await runDetection(tc.imagePath, flags);
        const time = performance.now() - start;

        const metrics = calculateMetrics(detections, tc.groundTruth);
        totalF1 += metrics.f1;
        totalTime += time;
    }

    return {
        avgF1: totalF1 / testCases.length,
        avgTime: totalTime / testCases.length,
    };
}

// ========================================
// Main experiment runner
// ========================================
async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       Scientific CV Improvements - Individual Testing           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await loadTemplates();
    const testCases = loadTestCases();
    console.log(`Test cases: ${testCases.length}\n`);

    // Run baseline
    console.log('Running baseline...');
    const baseline = await runTest(testCases, BASELINE_FLAGS, 'Baseline');
    console.log(`Baseline: F1=${(baseline.avgF1 * 100).toFixed(2)}%, Time=${baseline.avgTime.toFixed(0)}ms\n`);

    // Test each improvement individually
    const improvements: Array<{ name: string; key: keyof ImprovementFlags }> = [
        { name: 'Adjusted Grid Params', key: 'adjustedGridParams' },
        { name: 'Multi-Scale Matching', key: 'multiScale' },
        { name: 'Color Normalization', key: 'colorNormalization' },
        { name: 'Contrast Enhancement', key: 'contrastEnhancement' },
        { name: 'SSIM Metric', key: 'useSSIM' },
        { name: 'Lower Threshold', key: 'lowerThreshold' },
    ];

    console.log('Testing individual improvements:');
    console.log('─'.repeat(70));
    console.log(`| ${'Improvement'.padEnd(25)} | ${'F1 Score'.padEnd(12)} | ${'Change'.padEnd(10)} | Time     |`);
    console.log('─'.repeat(70));

    const results: Array<{ name: string; key: keyof ImprovementFlags; f1: number; time: number; delta: number }> = [];

    for (const imp of improvements) {
        const flags = { ...BASELINE_FLAGS, [imp.key]: true };
        const result = await runTest(testCases, flags, imp.name);

        const delta = ((result.avgF1 - baseline.avgF1) / baseline.avgF1 * 100);
        const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;

        results.push({ name: imp.name, key: imp.key, f1: result.avgF1, time: result.avgTime, delta });

        console.log(`| ${imp.name.padEnd(25)} | ${(result.avgF1 * 100).toFixed(2).padEnd(10)}% | ${deltaStr.padEnd(10)} | ${result.avgTime.toFixed(0).padStart(5)}ms |`);
    }

    console.log('─'.repeat(70));

    // Find improvements that helped
    const helpful = results.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta);

    console.log('\n\nImprovements that helped (sorted by impact):');
    if (helpful.length === 0) {
        console.log('  (none)');
    } else {
        helpful.forEach(r => console.log(`  ✓ ${r.name}: +${r.delta.toFixed(1)}%`));
    }

    // Test combined helpful improvements
    if (helpful.length > 0) {
        console.log('\n\nTesting combined improvements incrementally:');
        console.log('─'.repeat(70));

        let currentFlags = { ...BASELINE_FLAGS };
        let currentF1 = baseline.avgF1;
        const applied: string[] = [];

        for (const imp of helpful) {
            const testFlags = { ...currentFlags, [imp.key]: true };
            const result = await runTest(testCases, testFlags, `+${imp.name}`);

            const improvement = result.avgF1 >= currentF1;
            const delta = ((result.avgF1 - currentF1) / currentF1 * 100);

            if (improvement) {
                currentFlags = testFlags;
                currentF1 = result.avgF1;
                applied.push(imp.name);
                console.log(`✓ Added ${imp.name}: F1=${(result.avgF1 * 100).toFixed(2)}% (+${delta.toFixed(1)}%)`);
            } else {
                console.log(`✗ Skip ${imp.name}: would decrease F1 by ${(-delta).toFixed(1)}%`);
            }
        }

        console.log('─'.repeat(70));

        // Final results
        const finalResult = await runTest(testCases, currentFlags, 'Final');
        const totalImprovement = ((finalResult.avgF1 - baseline.avgF1) / baseline.avgF1 * 100);

        console.log('\n\n' + '═'.repeat(70));
        console.log('FINAL RESULTS');
        console.log('═'.repeat(70));
        console.log(`Baseline:     F1=${(baseline.avgF1 * 100).toFixed(2)}%, Time=${baseline.avgTime.toFixed(0)}ms`);
        console.log(`Optimized:    F1=${(finalResult.avgF1 * 100).toFixed(2)}%, Time=${finalResult.avgTime.toFixed(0)}ms`);
        console.log(`Improvement:  ${totalImprovement >= 0 ? '+' : ''}${totalImprovement.toFixed(1)}%`);

        console.log('\nApplied improvements:');
        if (applied.length === 0) {
            console.log('  (none - baseline is optimal)');
        } else {
            applied.forEach(name => console.log(`  - ${name}`));
        }

        console.log('\nOptimal flags:');
        console.log(JSON.stringify(currentFlags, null, 2));
    }
}

main().catch(console.error);
