#!/usr/bin/env node
// Test combined optimal parameters

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V1_DIR = './test-results/extracted-templates';

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

function detectGridPositions(width, height, params) {
    const scale = height / 720;
    const iconSize = Math.round(params.icon_size_base * scale);
    const spacing = Math.round(params.spacing_base * scale);
    const bottomMargin = Math.round(params.bottom_margin_base * scale);
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

async function runTest(params, templates, testCases) {
    let totalTP = 0, totalFP = 0, totalFN = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height, params);
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
            if (variance < params.min_variance) continue;

            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * params.crop_margin);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null, bestScore = 0;
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);
                if (score >= params.ncc_threshold && score > bestScore) {
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

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('=== Combined Parameter Test ===\n');

    const configs = [
        {
            name: 'Default',
            params: { ncc_threshold: 0.55, min_variance: 350, crop_margin: 0.10, icon_size_base: 34, spacing_base: 4, bottom_margin_base: 42 }
        },
        {
            name: 'min_variance=500',
            params: { ncc_threshold: 0.55, min_variance: 500, crop_margin: 0.10, icon_size_base: 34, spacing_base: 4, bottom_margin_base: 42 }
        },
        {
            name: 'bottom_margin=48',
            params: { ncc_threshold: 0.55, min_variance: 350, crop_margin: 0.10, icon_size_base: 34, spacing_base: 4, bottom_margin_base: 48 }
        },
        {
            name: 'Combined (var=500, margin=48)',
            params: { ncc_threshold: 0.55, min_variance: 500, crop_margin: 0.10, icon_size_base: 34, spacing_base: 4, bottom_margin_base: 48 }
        },
        {
            name: 'Combined + var=450',
            params: { ncc_threshold: 0.55, min_variance: 450, crop_margin: 0.10, icon_size_base: 34, spacing_base: 4, bottom_margin_base: 48 }
        },
        {
            name: 'Combined + thresh=0.60',
            params: { ncc_threshold: 0.60, min_variance: 500, crop_margin: 0.10, icon_size_base: 34, spacing_base: 4, bottom_margin_base: 48 }
        }
    ];

    console.log('| Config | TP | FP | FN | Precision | Recall | F1 Score |');
    console.log('|--------|----|----|-----|-----------|--------|----------|');

    for (const config of configs) {
        const result = await runTest(config.params, templates, testCases);
        console.log(`| ${config.name.padEnd(26)} | ${String(result.totalTP).padStart(2)} | ${String(result.totalFP).padStart(2)} | ${String(result.totalFN).padStart(3)} | ${(result.precision * 100).toFixed(1).padStart(8)}% | ${(result.recall * 100).toFixed(1).padStart(5)}% | ${(result.f1 * 100).toFixed(1).padStart(7)}% |`);
    }

    console.log('|--------|----|----|-----|-----------|--------|----------|');
}

main().catch(console.error);
