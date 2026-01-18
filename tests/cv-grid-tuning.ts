#!/usr/bin/env node
// Scientific Grid Parameter Tuning
// Find optimal grid detection parameters for different resolutions

import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
} catch { console.error('Canvas required'); process.exit(1); }

interface GridParams {
    iconSizeBase: number;      // Base icon size at reference resolution
    spacingBase: number;       // Base spacing at reference resolution
    bottomMarginBase: number;  // Base bottom margin at reference resolution
    sideMarginPct: number;     // Side margin as percentage of width
    refHeight: number;         // Reference height for scaling
    rowThreshold: number;      // Minimum Y as percentage of height
}

const BASELINE_PARAMS: GridParams = {
    iconSizeBase: 40,
    spacingBase: 4,
    bottomMarginBase: 20,
    sideMarginPct: 0.20,
    refHeight: 720,
    rowThreshold: 0.75,
};

// Parameter variations to test
const PARAM_VARIATIONS: Record<keyof GridParams, number[]> = {
    iconSizeBase: [35, 40, 45, 50, 55, 60],
    spacingBase: [2, 4, 6, 8],
    bottomMarginBase: [15, 20, 25, 30, 35],
    sideMarginPct: [0.10, 0.15, 0.20, 0.25],
    refHeight: [720, 800, 1080],
    rowThreshold: [0.65, 0.70, 0.75, 0.80],
};

interface GameItem { id: string; name: string; image?: string; rarity: string; }
interface TemplateData { item: GameItem; canvas: any; width: number; height: number; }

const templateCache = new Map<string, TemplateData>();

// Preprocessing functions (from scientific testing)
function enhanceContrast(imageData: any, factor: number = 1.5): any {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, 128 + (data[i] - 128) * factor));
        data[i+1] = Math.min(255, Math.max(0, 128 + (data[i+1] - 128) * factor));
        data[i+2] = Math.min(255, Math.max(0, 128 + (data[i+2] - 128) * factor));
    }
    return { data, width: imageData.width, height: imageData.height };
}

function normalizeColors(imageData: any): any {
    const data = new Uint8ClampedArray(imageData.data);
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]); maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i+1]); maxG = Math.max(maxG, data[i+1]);
        minB = Math.min(minB, data[i+2]); maxB = Math.max(maxB, data[i+2]);
    }
    const rR = maxR - minR || 1, rG = maxG - minG || 1, rB = maxB - minB || 1;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round((data[i] - minR) / rR * 255);
        data[i+1] = Math.round((data[i+1] - minG) / rG * 255);
        data[i+2] = Math.round((data[i+2] - minB) / rB * 255);
    }
    return { data, width: imageData.width, height: imageData.height };
}

function calculateNCC(d1: any, d2: any): number {
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(d1.data.length, d2.data.length);
    for (let i = 0; i < len; i += 4) {
        const g1 = (d1.data[i] + d1.data[i+1] + d1.data[i+2]) / 3;
        const g2 = (d2.data[i] + d2.data[i+1] + d2.data[i+2]) / 3;
        s1 += g1; s2 += g2; sp += g1*g2; ss1 += g1*g1; ss2 += g2*g2; c++;
    }
    const m1 = s1/c, m2 = s2/c;
    const num = sp/c - m1*m2;
    const den = Math.sqrt((ss1/c - m1*m1) * (ss2/c - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

async function loadTemplates() {
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
            templateCache.set(item.id, { item, canvas, width: img.width, height: img.height });
        } catch {}
    }
}

function detectGridPositions(width: number, height: number, params: GridParams) {
    const scale = height / params.refHeight;
    const iconSize = Math.round(params.iconSizeBase * scale);
    const spacing = Math.round(params.spacingBase * scale);
    const bottomMargin = Math.round(params.bottomMarginBase * scale);

    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const rowHeight = iconSize + spacing;

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * params.sideMarginPct);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * params.rowThreshold) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * (iconSize + spacing), y: rowY, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function isEmptyCell(imageData: any): boolean {
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 300 || mean < 40;
}

async function findBestMatch(cellData: any, cellW: number, cellH: number) {
    const margin = Math.round(cellW * 0.15);
    const cw = cellW - margin * 2, ch = cellH - margin * 2;
    if (cw <= 0 || ch <= 0) return null;

    const centerData = { data: new Uint8ClampedArray(cw * ch * 4), width: cw, height: ch };
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const src = ((y + margin) * cellW + (x + margin)) * 4;
            const dst = (y * cw + x) * 4;
            centerData.data[dst] = cellData.data[src];
            centerData.data[dst+1] = cellData.data[src+1];
            centerData.data[dst+2] = cellData.data[src+2];
            centerData.data[dst+3] = cellData.data[src+3];
        }
    }

    let processed = enhanceContrast(centerData);
    processed = normalizeColors(processed);

    let bestMatch: { item: GameItem; confidence: number } | null = null;

    for (const template of templateCache.values()) {
        const tMargin = Math.round(template.width * 0.15);
        const tempCanvas = createCanvas(cw, ch);
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(template.canvas, tMargin, tMargin,
            template.width - tMargin*2, template.height - tMargin*2, 0, 0, cw, ch);
        let templateData = tempCtx.getImageData(0, 0, cw, ch);
        templateData = enhanceContrast(templateData);
        templateData = normalizeColors(templateData);

        const similarity = calculateNCC(processed, templateData);
        if (!bestMatch || similarity > bestMatch.confidence) {
            bestMatch = { item: template.item, confidence: similarity };
        }
    }
    return bestMatch;
}

function loadTestCases() {
    const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
    const gt = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
    return Object.entries(gt)
        .filter(([name]) => !name.startsWith('_'))
        .map(([name, data]: [string, any]) => {
            const imagePath = path.join(__dirname, '../test-images/gameplay', name);
            if (!fs.existsSync(imagePath)) return null;
            const itemCounts = new Map<string, number>();
            for (const item of (data.items || [])) {
                itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
            }
            return {
                name, imagePath,
                groundTruth: Array.from(itemCounts.entries()).map(([name, count]) => ({
                    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, count
                })),
            };
        })
        .filter((tc): tc is NonNullable<typeof tc> => tc !== null);
}

async function runTest(testCases: any[], params: GridParams): Promise<number> {
    let totalF1 = 0;

    for (const tc of testCases) {
        const image = await loadImage(tc.imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const gridPositions = detectGridPositions(image.width, image.height, params);
        const detections: Array<{ id: string }> = [];

        for (const cell of gridPositions) {
            const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
            if (isEmptyCell(cellData)) continue;
            const match = await findBestMatch(cellData, cell.width, cell.height);
            if (match && match.confidence >= 0.45) {
                detections.push({ id: match.item.id });
            }
        }

        // Calculate F1
        const detected = new Map<string, number>();
        detections.forEach(d => detected.set(d.id, (detected.get(d.id) || 0) + 1));
        const truth = new Map<string, number>();
        tc.groundTruth.forEach((t: any) => truth.set(t.id, t.count));

        let tp = 0, fp = 0, fn = 0;
        detected.forEach((c, id) => { const t = truth.get(id) || 0; tp += Math.min(c, t); if (c > t) fp += c - t; });
        truth.forEach((c, id) => { const d = detected.get(id) || 0; if (d < c) fn += c - d; });

        const p = tp + fp > 0 ? tp / (tp + fp) : 0;
        const r = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = p + r > 0 ? 2 * p * r / (p + r) : 0;
        totalF1 += f1;
    }

    return totalF1 / testCases.length;
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         Scientific Grid Parameter Tuning                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    await loadTemplates();
    console.log(`Loaded ${templateCache.size} templates`);

    const testCases = loadTestCases();
    console.log(`Test cases: ${testCases.length}\n`);

    // Baseline
    console.log('Running baseline...');
    const baselineF1 = await runTest(testCases, BASELINE_PARAMS);
    console.log(`Baseline: F1=${(baselineF1 * 100).toFixed(2)}%\n`);

    // Test each parameter
    const results: Array<{ param: string; value: number; f1: number; delta: number }> = [];

    for (const [param, values] of Object.entries(PARAM_VARIATIONS)) {
        console.log(`\nTesting ${param}:`);
        console.log(`  Values: ${values.join(', ')}`);

        for (const value of values) {
            const testParams = { ...BASELINE_PARAMS, [param]: value };
            const f1 = await runTest(testCases, testParams);
            const delta = ((f1 - baselineF1) / baselineF1 * 100);

            results.push({ param, value, f1, delta });

            const marker = value === BASELINE_PARAMS[param as keyof GridParams] ? ' *' : '';
            const sign = delta >= 0 ? '+' : '';
            console.log(`  ${param}=${value}${marker}: F1=${(f1 * 100).toFixed(2)}% (${sign}${delta.toFixed(1)}%)`);
        }
    }

    // Find best value for each param
    console.log('\n\n' + '═'.repeat(60));
    console.log('OPTIMAL VALUES PER PARAMETER');
    console.log('═'.repeat(60));

    const paramBests = new Map<string, { value: number; f1: number }>();
    for (const r of results) {
        const current = paramBests.get(r.param);
        if (!current || r.f1 > current.f1) {
            paramBests.set(r.param, { value: r.value, f1: r.f1 });
        }
    }

    const optimalParams = { ...BASELINE_PARAMS };
    for (const [param, best] of paramBests) {
        const baseline = BASELINE_PARAMS[param as keyof GridParams];
        const delta = ((best.f1 - baselineF1) / baselineF1 * 100);
        console.log(`${param}: ${baseline} → ${best.value} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`);
        (optimalParams as any)[param] = best.value;
    }

    // Test combined optimal params
    console.log('\n\nTesting combined optimal parameters...');
    const combinedF1 = await runTest(testCases, optimalParams);
    const combinedDelta = ((combinedF1 - baselineF1) / baselineF1 * 100);

    console.log(`\nCombined: F1=${(combinedF1 * 100).toFixed(2)}% (${combinedDelta >= 0 ? '+' : ''}${combinedDelta.toFixed(1)}%)`);

    // Incremental combination
    console.log('\n\nIncremental combination (keeping only improvements)...');
    let currentParams = { ...BASELINE_PARAMS };
    let currentF1 = baselineF1;

    const sortedParams = [...paramBests.entries()].sort((a, b) => b[1].f1 - a[1].f1);

    for (const [param, best] of sortedParams) {
        const testParams = { ...currentParams, [param]: best.value };
        const f1 = await runTest(testCases, testParams);

        if (f1 >= currentF1) {
            currentParams = testParams;
            currentF1 = f1;
            console.log(`✓ ${param}=${best.value}: F1=${(f1 * 100).toFixed(2)}%`);
        } else {
            console.log(`✗ ${param}=${best.value}: would decrease F1`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('FINAL OPTIMIZED GRID PARAMETERS');
    console.log('═'.repeat(60));
    console.log(JSON.stringify(currentParams, null, 2));
    console.log(`\nFinal F1: ${(currentF1 * 100).toFixed(2)}% (${((currentF1 - baselineF1) / baselineF1 * 100).toFixed(1)}% improvement)`);
}

main().catch(console.error);
