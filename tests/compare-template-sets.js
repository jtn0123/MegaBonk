#!/usr/bin/env node
// Compare template sets against ground truth
// Tests both V1 (curated) and summary screen templates

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V1_DIR = './test-results/extracted-templates';
const SUMMARY_DIR = './test-results/summary-templates';

// Optimal parameters from tuning
const PARAMS = {
    ncc_threshold: 0.55,
    min_variance: 500,
    crop_margin: 0.10,
    icon_size_base: 34,
    spacing_base: 4,
    bottom_margin_base: 48
};

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
    const iconSize = Math.round(PARAMS.icon_size_base * scale);
    const spacing = Math.round(PARAMS.spacing_base * scale);
    const bottomMargin = Math.round(PARAMS.bottom_margin_base * scale);
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

async function loadTemplatesFromDir(dir) {
    const templates = new Map();
    if (!fs.existsSync(dir)) return templates;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && !f.startsWith('_'));
    for (const file of files) {
        const itemId = file.replace('.png', '');
        try {
            const img = await loadImage(path.join(dir, file));
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
        } catch (e) {
            // Skip invalid images
        }
    }
    return templates;
}

async function runTest(templates, testCases) {
    let totalTP = 0, totalFP = 0, totalFN = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        // Skip non-gameplay images (summary screens, results, etc.)
        if (data.ui_state === 'end_game_summary' || data.ui_state === 'inventory_chest') continue;

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
            if (variance < PARAMS.min_variance) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * PARAMS.crop_margin);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null, bestScore = 0;
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);
                if (score >= PARAMS.ncc_threshold && score > bestScore) {
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

    return { totalTP, totalFP, totalFN, precision, recall, f1 };
}

async function main() {
    console.log('=== Template Set Comparison ===\n');

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log(`Test cases: ${testCases.length} (excluding summary/inventory screens)\n`);

    // Load both template sets
    const v1Templates = await loadTemplatesFromDir(V1_DIR);
    const summaryTemplates = await loadTemplatesFromDir(SUMMARY_DIR);

    console.log(`V1 templates: ${v1Templates.size}`);
    console.log(`Summary templates: ${summaryTemplates.size}\n`);

    // Test V1 templates
    console.log('Testing V1 (curated) templates...');
    const v1Result = await runTest(v1Templates, testCases);
    console.log(`  TP=${v1Result.totalTP}, FP=${v1Result.totalFP}, FN=${v1Result.totalFN}`);
    console.log(`  Precision: ${(v1Result.precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(v1Result.recall * 100).toFixed(1)}%`);
    console.log(`  F1: ${(v1Result.f1 * 100).toFixed(1)}%\n`);

    // Test summary templates
    console.log('Testing Summary screen templates...');
    const summaryResult = await runTest(summaryTemplates, testCases);
    console.log(`  TP=${summaryResult.totalTP}, FP=${summaryResult.totalFP}, FN=${summaryResult.totalFN}`);
    console.log(`  Precision: ${(summaryResult.precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(summaryResult.recall * 100).toFixed(1)}%`);
    console.log(`  F1: ${(summaryResult.f1 * 100).toFixed(1)}%\n`);

    // Test combined (V1 + Summary)
    const combinedTemplates = new Map([...v1Templates, ...summaryTemplates]);
    console.log(`Combined templates: ${combinedTemplates.size}`);
    console.log('Testing Combined templates...');
    const combinedResult = await runTest(combinedTemplates, testCases);
    console.log(`  TP=${combinedResult.totalTP}, FP=${combinedResult.totalFP}, FN=${combinedResult.totalFN}`);
    console.log(`  Precision: ${(combinedResult.precision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(combinedResult.recall * 100).toFixed(1)}%`);
    console.log(`  F1: ${(combinedResult.f1 * 100).toFixed(1)}%\n`);

    // Summary table
    console.log('=== Summary ===');
    console.log('| Template Set | Templates | TP | FP | FN | Precision | Recall | F1 |');
    console.log('|--------------|-----------|----|----|-----|-----------|--------|-----|');
    console.log(`| V1 (curated) | ${String(v1Templates.size).padStart(9)} | ${String(v1Result.totalTP).padStart(2)} | ${String(v1Result.totalFP).padStart(2)} | ${String(v1Result.totalFN).padStart(3)} | ${(v1Result.precision * 100).toFixed(1).padStart(8)}% | ${(v1Result.recall * 100).toFixed(1).padStart(5)}% | ${(v1Result.f1 * 100).toFixed(1).padStart(4)}% |`);
    console.log(`| Summary      | ${String(summaryTemplates.size).padStart(9)} | ${String(summaryResult.totalTP).padStart(2)} | ${String(summaryResult.totalFP).padStart(2)} | ${String(summaryResult.totalFN).padStart(3)} | ${(summaryResult.precision * 100).toFixed(1).padStart(8)}% | ${(summaryResult.recall * 100).toFixed(1).padStart(5)}% | ${(summaryResult.f1 * 100).toFixed(1).padStart(4)}% |`);
    console.log(`| Combined     | ${String(combinedTemplates.size).padStart(9)} | ${String(combinedResult.totalTP).padStart(2)} | ${String(combinedResult.totalFP).padStart(2)} | ${String(combinedResult.totalFN).padStart(3)} | ${(combinedResult.precision * 100).toFixed(1).padStart(8)}% | ${(combinedResult.recall * 100).toFixed(1).padStart(5)}% | ${(combinedResult.f1 * 100).toFixed(1).padStart(4)}% |`);
}

main().catch(console.error);
