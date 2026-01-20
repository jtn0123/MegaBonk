#!/usr/bin/env node
// Quick CV parameter tuning - test a few promising combinations
import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
    globalThis.ImageData = canvas.ImageData;
    console.log('✓ Canvas loaded');
} catch {
    console.error('❌ Canvas required');
    process.exit(1);
}

// Parameter presets to test
const TUNING_PRESETS = {
    baseline: {
        minConfidence: 0.72,
        nmsIouThreshold: 0.30,
        slidingWindowStep: 12,
        emptyVarianceThreshold: 500,
        iconRegionPercent: 0.80,
        pass1Threshold: 0.85,
        pass2Threshold: 0.70,
        pass3Threshold: 0.60,
    },
    // Lower confidence - catch more items
    lenient: {
        minConfidence: 0.55,
        nmsIouThreshold: 0.25,
        slidingWindowStep: 8,
        emptyVarianceThreshold: 400,
        iconRegionPercent: 0.75,
        pass1Threshold: 0.75,
        pass2Threshold: 0.60,
        pass3Threshold: 0.50,
    },
    // Higher precision - fewer false positives
    strict: {
        minConfidence: 0.80,
        nmsIouThreshold: 0.35,
        slidingWindowStep: 10,
        emptyVarianceThreshold: 600,
        iconRegionPercent: 0.85,
        pass1Threshold: 0.90,
        pass2Threshold: 0.78,
        pass3Threshold: 0.68,
    },
    // Optimized based on debug analysis
    tuned: {
        minConfidence: 0.60,
        nmsIouThreshold: 0.20,
        slidingWindowStep: 8,
        emptyVarianceThreshold: 350,
        iconRegionPercent: 0.70,
        pass1Threshold: 0.78,
        pass2Threshold: 0.65,
        pass3Threshold: 0.55,
    },
};

type PresetName = keyof typeof TUNING_PRESETS;
type Params = typeof TUNING_PRESETS.baseline;

// Load ground truth
const gtPath = path.join(__dirname, '../test-images/gameplay/ground-truth.json');
const groundTruth = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));

// Load item templates
const itemsPath = path.join(__dirname, '../data/items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));

interface TemplateData {
    id: string;
    name: string;
    rarity: string;
    canvas: any;
    width: number;
    height: number;
}

const templates: TemplateData[] = [];

async function loadTemplates(): Promise<void> {
    for (const item of itemsData.items) {
        if (!item.image) continue;
        const tPath = path.join(__dirname, '../src/', item.image);
        if (!fs.existsSync(tPath)) continue;

        try {
            const img = await loadImage(tPath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            templates.push({
                id: item.id,
                name: item.name,
                rarity: item.rarity,
                canvas,
                width: img.width,
                height: img.height,
            });
        } catch {}
    }
    console.log(`📦 Loaded ${templates.length} templates`);
}

// Simple NCC (Normalized Cross-Correlation) matching
function computeNCC(imgData: ImageData, template: TemplateData, x: number, y: number): number {
    const tCtx = template.canvas.getContext('2d');
    const tData = tCtx.getImageData(0, 0, template.width, template.height);

    let sumI = 0, sumT = 0, sumII = 0, sumTT = 0, sumIT = 0;
    let count = 0;

    for (let ty = 0; ty < template.height; ty++) {
        for (let tx = 0; tx < template.width; tx++) {
            const ix = x + tx;
            const iy = y + ty;

            if (ix >= imgData.width || iy >= imgData.height) continue;

            const imgIdx = (iy * imgData.width + ix) * 4;
            const tIdx = (ty * template.width + tx) * 4;

            // Grayscale values
            const iVal = (imgData.data[imgIdx]! + imgData.data[imgIdx + 1]! + imgData.data[imgIdx + 2]!) / 3;
            const tVal = (tData.data[tIdx]! + tData.data[tIdx + 1]! + tData.data[tIdx + 2]!) / 3;

            sumI += iVal;
            sumT += tVal;
            sumII += iVal * iVal;
            sumTT += tVal * tVal;
            sumIT += iVal * tVal;
            count++;
        }
    }

    if (count === 0) return 0;

    const meanI = sumI / count;
    const meanT = sumT / count;
    const varI = sumII / count - meanI * meanI;
    const varT = sumTT / count - meanT * meanT;
    const covar = sumIT / count - meanI * meanT;

    if (varI <= 0 || varT <= 0) return 0;

    return covar / Math.sqrt(varI * varT);
}

// Detect items with given parameters
async function detectItems(imagePath: string, params: Params): Promise<Array<{name: string; confidence: number}>> {
    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    const detections: Array<{name: string; confidence: number; x: number; y: number}> = [];

    // Scan bottom portion of screen (hotbar area)
    const scanTop = Math.floor(img.height * 0.75);
    const iconSize = Math.round(40 * (img.height / 720));

    for (let y = scanTop; y < img.height - iconSize; y += params.slidingWindowStep) {
        for (let x = 0; x < img.width - iconSize; x += params.slidingWindowStep) {
            // Check variance to skip empty regions
            let variance = 0;
            let sumVal = 0;
            let sumSq = 0;
            let count = 0;

            for (let dy = 0; dy < iconSize && y + dy < img.height; dy++) {
                for (let dx = 0; dx < iconSize && x + dx < img.width; dx++) {
                    const idx = ((y + dy) * img.width + (x + dx)) * 4;
                    const val = (imgData.data[idx]! + imgData.data[idx + 1]! + imgData.data[idx + 2]!) / 3;
                    sumVal += val;
                    sumSq += val * val;
                    count++;
                }
            }

            if (count > 0) {
                const mean = sumVal / count;
                variance = sumSq / count - mean * mean;
            }

            if (variance < params.emptyVarianceThreshold) continue;

            // Match against templates
            let bestMatch: {name: string; confidence: number} | null = null;

            for (const template of templates) {
                const ncc = computeNCC(imgData, template, x, y);

                if (ncc >= params.minConfidence) {
                    if (!bestMatch || ncc > bestMatch.confidence) {
                        bestMatch = { name: template.name, confidence: ncc };
                    }
                }
            }

            if (bestMatch) {
                detections.push({ ...bestMatch, x, y });
            }
        }
    }

    // Simple NMS - remove overlapping detections
    const nmsResults: typeof detections = [];
    const sorted = detections.sort((a, b) => b.confidence - a.confidence);

    for (const det of sorted) {
        let dominated = false;
        for (const kept of nmsResults) {
            const dx = Math.abs(det.x - kept.x);
            const dy = Math.abs(det.y - kept.y);
            if (dx < iconSize * (1 - params.nmsIouThreshold) && dy < iconSize * (1 - params.nmsIouThreshold)) {
                dominated = true;
                break;
            }
        }
        if (!dominated) {
            nmsResults.push(det);
        }
    }

    return nmsResults.map(d => ({ name: d.name, confidence: d.confidence }));
}

// Calculate F1 score
function calculateF1(detected: string[], expected: string[]): { f1: number; precision: number; recall: number; tp: number; fp: number; fn: number } {
    const detSet = new Map<string, number>();
    const expSet = new Map<string, number>();

    for (const d of detected) detSet.set(d, (detSet.get(d) || 0) + 1);
    for (const e of expected) expSet.set(e, (expSet.get(e) || 0) + 1);

    let tp = 0;
    for (const [name, count] of detSet) {
        const expCount = expSet.get(name) || 0;
        tp += Math.min(count, expCount);
    }

    const fp = detected.length - tp;
    const fn = expected.length - tp;

    const precision = detected.length > 0 ? tp / detected.length : 0;
    const recall = expected.length > 0 ? tp / expected.length : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    return { f1, precision, recall, tp, fp, fn };
}

async function runTests(): Promise<void> {
    await loadTemplates();

    // Get test images
    const testCases = Object.entries(groundTruth).slice(0, 5); // Test first 5

    console.log('\n' + '═'.repeat(70));
    console.log('  QUICK CV PARAMETER TUNING');
    console.log('═'.repeat(70));

    const results: Record<PresetName, { totalF1: number; count: number }> = {
        baseline: { totalF1: 0, count: 0 },
        lenient: { totalF1: 0, count: 0 },
        strict: { totalF1: 0, count: 0 },
        tuned: { totalF1: 0, count: 0 },
    };

    for (const [imageName, data] of testCases) {
        const imagePath = path.join(__dirname, '../test-images/gameplay', imageName);
        if (!fs.existsSync(imagePath)) {
            console.log(`⚠️  Skipping: ${imageName}`);
            continue;
        }

        const expected = (data as any).items as string[];
        console.log(`\n📷 ${imageName}`);
        console.log(`   Expected: ${expected.length} items`);

        for (const [presetName, params] of Object.entries(TUNING_PRESETS) as [PresetName, Params][]) {
            const start = Date.now();
            const detected = await detectItems(imagePath, params);
            const elapsed = Date.now() - start;

            const metrics = calculateF1(detected.map(d => d.name), expected);
            results[presetName].totalF1 += metrics.f1;
            results[presetName].count++;

            const f1Pct = (metrics.f1 * 100).toFixed(1);
            const status = metrics.f1 >= 0.5 ? '✅' : metrics.f1 >= 0.2 ? '⚠️' : '❌';
            console.log(`   ${status} ${presetName.padEnd(10)}: F1=${f1Pct.padStart(5)}% (P=${(metrics.precision*100).toFixed(0)}% R=${(metrics.recall*100).toFixed(0)}%) ${elapsed}ms det=${detected.length}`);
        }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  SUMMARY - Average F1 Scores');
    console.log('═'.repeat(70));

    const sorted = Object.entries(results)
        .map(([name, data]) => ({ name, avgF1: data.count > 0 ? data.totalF1 / data.count : 0 }))
        .sort((a, b) => b.avgF1 - a.avgF1);

    for (const { name, avgF1 } of sorted) {
        const bar = '█'.repeat(Math.round(avgF1 * 40));
        const pct = (avgF1 * 100).toFixed(1);
        console.log(`  ${name.padEnd(10)}: ${pct.padStart(5)}% ${bar}`);
    }

    console.log('\n🏆 Best preset:', sorted[0]?.name);
    console.log('');
}

runTests().catch(console.error);
