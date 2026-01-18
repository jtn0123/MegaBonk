#!/usr/bin/env node
// Scientific parameter sweep - one variable at a time
// Usage: node parameter-sweep.js [parameter-name]

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V1_DIR = './test-results/extracted-templates';

// ==================== PARAMETERS TO TEST ====================
const PARAMETERS = {
    // NCC threshold for accepting a match
    ncc_threshold: {
        default: 0.55,
        range: [0.45, 0.50, 0.55, 0.60, 0.65, 0.70],
        description: 'Minimum NCC score to accept a match'
    },
    // Minimum variance to consider cell non-empty
    min_variance: {
        default: 350,
        range: [250, 300, 350, 400, 450, 500],
        description: 'Minimum pixel variance for non-empty cell'
    },
    // Crop margin when resizing cell to 32x32
    crop_margin: {
        default: 0.10,
        range: [0.00, 0.05, 0.10, 0.15, 0.20],
        description: 'Margin to crop from cell edges (fraction)'
    },
    // Icon size base (at 720p reference)
    icon_size_base: {
        default: 34,
        range: [30, 32, 34, 36, 38],
        description: 'Base icon size at 720p resolution'
    },
    // Cell spacing base
    spacing_base: {
        default: 4,
        range: [2, 3, 4, 5, 6],
        description: 'Base spacing between cells'
    },
    // Bottom margin base
    bottom_margin_base: {
        default: 42,
        range: [36, 39, 42, 45, 48],
        description: 'Base bottom margin for inventory'
    }
};

// ==================== CORE FUNCTIONS ====================
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

// ==================== TEST RUNNER ====================
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

// ==================== MAIN ====================
async function main() {
    const paramToTest = process.argv[2];

    // Load templates once
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

    // Load test cases once
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Get default params
    const defaultParams = {};
    for (const [key, config] of Object.entries(PARAMETERS)) {
        defaultParams[key] = config.default;
    }

    if (!paramToTest || paramToTest === 'list') {
        console.log('=== Available Parameters ===\n');
        for (const [key, config] of Object.entries(PARAMETERS)) {
            console.log(`${key}:`);
            console.log(`  Default: ${config.default}`);
            console.log(`  Range: ${config.range.join(', ')}`);
            console.log(`  Description: ${config.description}\n`);
        }
        console.log('Usage: node parameter-sweep.js <parameter-name>');
        console.log('       node parameter-sweep.js all');
        return;
    }

    if (paramToTest === 'all') {
        // Run all parameters one at a time
        console.log('=== Full Parameter Sweep ===\n');

        for (const [paramName, config] of Object.entries(PARAMETERS)) {
            console.log(`\n--- ${paramName} ---`);
            console.log(`Description: ${config.description}`);
            console.log(`| Value | TP | FP | FN | Prec | Recall | F1 |`);
            console.log(`|-------|----|----|-----|------|--------|------|`);

            for (const value of config.range) {
                const params = { ...defaultParams, [paramName]: value };
                const result = await runTest(params, templates, testCases);
                const marker = value === config.default ? ' *' : '';
                console.log(`| ${String(value).padStart(5)}${marker} | ${String(result.totalTP).padStart(2)} | ${String(result.totalFP).padStart(2)} | ${String(result.totalFN).padStart(3)} | ${(result.precision * 100).toFixed(0).padStart(3)}% | ${(result.recall * 100).toFixed(0).padStart(5)}% | ${(result.f1 * 100).toFixed(1).padStart(4)}% |`);
            }
        }
    } else if (PARAMETERS[paramToTest]) {
        const config = PARAMETERS[paramToTest];
        console.log(`=== Sweep: ${paramToTest} ===`);
        console.log(`Description: ${config.description}`);
        console.log(`Default: ${config.default}\n`);

        console.log(`| Value | TP | FP | FN | Precision | Recall | F1 Score |`);
        console.log(`|-------|----|----|-----|-----------|--------|----------|`);

        let bestF1 = 0, bestValue = config.default;

        for (const value of config.range) {
            const params = { ...defaultParams, [paramToTest]: value };
            const result = await runTest(params, templates, testCases);

            const marker = value === config.default ? ' (default)' : '';
            console.log(`| ${String(value).padStart(5)} | ${String(result.totalTP).padStart(2)} | ${String(result.totalFP).padStart(2)} | ${String(result.totalFN).padStart(3)} | ${(result.precision * 100).toFixed(1).padStart(8)}% | ${(result.recall * 100).toFixed(1).padStart(5)}% | ${(result.f1 * 100).toFixed(1).padStart(7)}% |${marker}`);

            if (result.f1 > bestF1) {
                bestF1 = result.f1;
                bestValue = value;
            }
        }

        console.log(`|-------|----|----|-----|-----------|--------|----------|`);
        console.log(`\nBest value: ${bestValue} (F1: ${(bestF1 * 100).toFixed(1)}%)`);

    } else {
        console.log(`Unknown parameter: ${paramToTest}`);
        console.log('Run with "list" to see available parameters');
    }
}

main().catch(console.error);
