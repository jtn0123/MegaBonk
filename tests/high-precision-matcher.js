#!/usr/bin/env node
// High-Precision Matcher - prioritize precision over recall
// Strategy: Only match when very confident, use multiple confirmation signals

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V1_DIR = './test-results/extracted-templates';

// Higher base threshold
const BASE_THRESHOLD = 0.65;

// Additional confirmation requirements
const MIN_SECOND_BEST_GAP = 0.05;  // Best match must be 5% better than second best
const MIN_VARIANCE = 400;  // Higher variance requirement

function calculateNCC(d1, d2) {
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

function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y < height * 0.65) continue;
        const sideMargin = Math.round(width * 0.15);
        const cellWidth = iconSize + spacing;
        const maxItemsPerRow = Math.min(22, Math.floor((width - sideMargin * 2) / cellWidth));
        const totalWidth = maxItemsPerRow * cellWidth;
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function normalizeItemId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function loadTemplates() {
    const templates = new Map();
    if (!fs.existsSync(V1_DIR)) return templates;
    const files = fs.readdirSync(V1_DIR).filter(f => f.endsWith('.png'));
    for (const file of files) {
        const itemId = file.replace('.png', '');
        const img = await loadImage(path.join(V1_DIR, file));
        const canvas = createCanvas(32, 32);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 32, 32);
        templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
    }
    return templates;
}

async function runTest(threshold, gapRequired, minVariance) {
    const templates = await loadTemplates();
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    let totalTP = 0, totalFP = 0, totalFN = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);
        const expectedItems = (data.items || []).map(normalizeItemId);

        const expectedCounts = new Map();
        for (const item of expectedItems) {
            expectedCounts.set(item, (expectedCounts.get(item) || 0) + 1);
        }

        const detectedCounts = new Map();

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;
            if (variance < minVariance) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            // Match against all templates
            const scores = [];
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);
                scores.push({ itemId, score });
            }
            scores.sort((a, b) => b.score - a.score);

            const best = scores[0];
            const secondBest = scores[1];

            // High precision criteria:
            // 1. Best score above threshold
            // 2. Gap to second best is significant (disambiguation)
            if (best && best.score >= threshold) {
                const gap = secondBest ? best.score - secondBest.score : 1;
                if (gap >= gapRequired) {
                    detectedCounts.set(best.itemId, (detectedCounts.get(best.itemId) || 0) + 1);
                }
            }
        }

        // Calculate TP/FP/FN
        for (const [item, expected] of expectedCounts) {
            const detected = detectedCounts.get(item) || 0;
            totalTP += Math.min(expected, detected);
            totalFN += Math.max(0, expected - detected);
        }
        for (const [item, detected] of detectedCounts) {
            const expected = expectedCounts.get(item) || 0;
            totalFP += Math.max(0, detected - expected);
        }
    }

    const precision = totalTP / (totalTP + totalFP) || 0;
    const recall = totalTP / (totalTP + totalFN) || 0;
    const f1 = 2 * precision * recall / (precision + recall) || 0;

    return { threshold, gapRequired, minVariance, totalTP, totalFP, totalFN, precision, recall, f1 };
}

async function main() {
    console.log('=== High-Precision Matcher - Parameter Sweep ===\n');

    const results = [];

    // Test different parameter combinations
    const thresholds = [0.55, 0.60, 0.65, 0.70, 0.75];
    const gaps = [0, 0.03, 0.05, 0.08, 0.10];
    const variances = [350, 400, 450, 500];

    console.log('Running parameter sweep...\n');

    // Quick sweep with fixed variance
    for (const threshold of thresholds) {
        for (const gap of [0, 0.05]) {
            const result = await runTest(threshold, gap, 400);
            results.push(result);
        }
    }

    // Sort by F1
    results.sort((a, b) => b.f1 - a.f1);

    console.log('| Thresh | Gap | TP | FP | FN | Prec | Recall | F1 |');
    console.log('|--------|-----|----|----|-----|------|--------|-----|');

    for (const r of results) {
        console.log(`| ${r.threshold.toFixed(2).padStart(6)} | ${r.gapRequired.toFixed(2).padStart(4)} | ${String(r.totalTP).padStart(2)} | ${String(r.totalFP).padStart(2)} | ${String(r.totalFN).padStart(3)} | ${(r.precision * 100).toFixed(0).padStart(3)}% | ${(r.recall * 100).toFixed(0).padStart(5)}% | ${(r.f1 * 100).toFixed(1).padStart(4)}% |`);
    }

    console.log('|--------|-----|----|----|-----|------|--------|-----|\n');

    const best = results[0];
    console.log(`Best configuration:`);
    console.log(`  Threshold: ${best.threshold}`);
    console.log(`  Gap required: ${best.gapRequired}`);
    console.log(`  F1 Score: ${(best.f1 * 100).toFixed(1)}%`);
    console.log(`  Precision: ${(best.precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(best.recall * 100).toFixed(1)}%`);

    // Find best precision config with F1 > 15%
    const highPrecision = results.filter(r => r.f1 > 0.15).sort((a, b) => b.precision - a.precision)[0];
    if (highPrecision) {
        console.log(`\nHighest precision config (F1 > 15%):`);
        console.log(`  Threshold: ${highPrecision.threshold}`);
        console.log(`  Gap required: ${highPrecision.gapRequired}`);
        console.log(`  Precision: ${(highPrecision.precision * 100).toFixed(1)}%`);
        console.log(`  F1 Score: ${(highPrecision.f1 * 100).toFixed(1)}%`);
    }
}

main().catch(console.error);
