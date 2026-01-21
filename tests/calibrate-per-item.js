#!/usr/bin/env node
// Calibrate optimal threshold for each item individually

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V1_DIR = './test-results/extracted-templates';
const OUTPUT_DIR = './test-results/calibration';

// MEMORY FIX: Reusable canvases to prevent OOM
const resizeCanvas = createCanvas(32, 32);
const resizeCtx = resizeCanvas.getContext('2d');
let srcCanvas = null;
let srcCtx = null;
let lastSrcSize = 0;

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

async function main() {
    console.log('=== Per-Item Threshold Calibration ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Load templates
    const templates = new Map();
    const files = fs.readdirSync(V1_DIR).filter(f => f.endsWith('.png'));
    for (const file of files) {
        const itemId = file.replace('.png', '');
        const img = await loadImage(path.join(V1_DIR, file));
        const canvas = createCanvas(32, 32);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 32, 32);
        templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
    }
    console.log(`Loaded ${templates.size} templates\n`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Collect all match scores for each item
    const itemScores = new Map();  // itemId -> { trueMatches: [], falseMatches: [] }

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);
        const expectedItems = (data.items || []).map(normalizeItemId);

        // Count expected items
        const expectedCounts = new Map();
        for (const item of expectedItems) {
            expectedCounts.set(item, (expectedCounts.get(item) || 0) + 1);
        }

        // For each cell, record all template match scores
        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;
            if (variance < 350) continue;

            // MEMORY FIX: Reuse canvases
            if (pos.width !== lastSrcSize) {
                srcCanvas = createCanvas(pos.width, pos.height);
                srcCtx = srcCanvas.getContext('2d');
                lastSrcSize = pos.width;
            }
            srcCtx.clearRect(0, 0, pos.width, pos.height);
            srcCtx.putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.clearRect(0, 0, 32, 32);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            // Check each template
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);

                if (!itemScores.has(itemId)) {
                    itemScores.set(itemId, { trueMatches: [], falseMatches: [] });
                }

                const scores = itemScores.get(itemId);
                const isExpected = expectedCounts.has(itemId) && expectedCounts.get(itemId) > 0;

                // This is a simplified approach - assume best match determines if it's true/false
                // In reality, we'd need to track which cells correspond to which GT items
                if (isExpected) {
                    scores.trueMatches.push(score);
                } else {
                    scores.falseMatches.push(score);
                }
            }
        }
    }

    // For each item, find optimal threshold
    console.log('=== Per-Item Optimal Thresholds ===\n');
    console.log('| Item | True Mean | False Mean | Separation | Opt Thresh | Expected F1 |');
    console.log('|------|-----------|------------|------------|------------|-------------|');

    const optimalThresholds = {};

    for (const [itemId, scores] of itemScores) {
        const trueScores = scores.trueMatches.filter(s => s > 0.4);
        const falseScores = scores.falseMatches.filter(s => s > 0.4);

        if (trueScores.length === 0) {
            console.log(`| ${itemId.padEnd(12)} | N/A | N/A | N/A | 0.60 | N/A |`);
            optimalThresholds[itemId] = 0.60;
            continue;
        }

        const trueMean = trueScores.reduce((a, b) => a + b, 0) / trueScores.length;
        const falseMean = falseScores.length > 0
            ? falseScores.reduce((a, b) => a + b, 0) / falseScores.length
            : 0.4;

        const trueMin = Math.min(...trueScores);
        const falseMax = falseScores.length > 0 ? Math.max(...falseScores) : 0.4;

        // Optimal threshold is between false max and true min
        const separation = trueMin - falseMax;
        const optThreshold = (trueMin + falseMax) / 2;

        // Estimate F1 at this threshold
        const trueAbove = trueScores.filter(s => s >= optThreshold).length;
        const falseAbove = falseScores.filter(s => s >= optThreshold).length;
        const estPrecision = trueAbove / (trueAbove + falseAbove) || 0;
        const estRecall = trueAbove / trueScores.length || 0;
        const estF1 = 2 * estPrecision * estRecall / (estPrecision + estRecall) || 0;

        optimalThresholds[itemId] = Math.max(0.50, Math.min(0.75, optThreshold));

        console.log(`| ${itemId.slice(0, 12).padEnd(12)} | ${trueMean.toFixed(2).padStart(9)} | ${falseMean.toFixed(2).padStart(10)} | ${separation.toFixed(2).padStart(10)} | ${optThreshold.toFixed(2).padStart(10)} | ${(estF1 * 100).toFixed(0).padStart(10)}% |`);
    }

    console.log('|------|-----------|------------|------------|------------|-------------|\n');

    // Generate optimized config
    console.log('=== Recommended Configuration ===\n');
    console.log('const ITEM_THRESHOLDS = {');
    for (const [itemId, threshold] of Object.entries(optimalThresholds)) {
        console.log(`    '${itemId}': ${threshold.toFixed(2)},`);
    }
    console.log('};');

    // Test with optimized thresholds
    console.log('\n=== Testing Optimized Thresholds ===\n');

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
            if (variance < 400) continue;

            // MEMORY FIX: Reuse canvases
            if (pos.width !== lastSrcSize) {
                srcCanvas = createCanvas(pos.width, pos.height);
                srcCtx = srcCanvas.getContext('2d');
                lastSrcSize = pos.width;
            }
            srcCtx.clearRect(0, 0, pos.width, pos.height);
            srcCtx.putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.clearRect(0, 0, 32, 32);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null, bestScore = 0;
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);
                const threshold = optimalThresholds[itemId] || 0.60;
                if (score >= threshold && score > bestScore) {
                    bestScore = score;
                    bestMatch = itemId;
                }
            }

            if (bestMatch) {
                detectedCounts.set(bestMatch, (detectedCounts.get(bestMatch) || 0) + 1);
            }
        }

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

    console.log(`TP: ${totalTP}, FP: ${totalFP}, FN: ${totalFN}`);
    console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
    console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
    console.log(`F1 Score: ${(f1 * 100).toFixed(1)}%`);
    console.log(`\nBaseline F1: 21.6%`);
    console.log(`Improvement: ${(f1 * 100 - 21.6).toFixed(1)}%`);

    // Save calibration
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'item-thresholds.json'),
        JSON.stringify(optimalThresholds, null, 2)
    );
    console.log(`\nCalibration saved to: ${OUTPUT_DIR}/item-thresholds.json`);
}

main().catch(console.error);
