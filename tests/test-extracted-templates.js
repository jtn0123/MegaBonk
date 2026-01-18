#!/usr/bin/env node
// Test extracted templates against ground truth

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const TEMPLATE_DIRS = {
    'v1': './test-results/extracted-templates',
    'v2': './test-results/extracted-templates-v2',
    'wiki': null  // Will load from data/items.json
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

async function loadTemplates(source) {
    const templates = new Map();

    if (source === 'wiki') {
        const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
        for (const item of itemsData.items) {
            if (!item.image) continue;
            const imagePath = path.join('./src/', item.image);
            if (!fs.existsSync(imagePath)) continue;
            try {
                const img = await loadImage(imagePath);
                const canvas = createCanvas(32, 32);
                const ctx = canvas.getContext('2d');
                const margin = Math.round(img.width * 0.1);
                ctx.drawImage(img, margin, margin, img.width - margin*2, img.height - margin*2, 0, 0, 32, 32);
                templates.set(item.id, { name: item.name, imageData: ctx.getImageData(0, 0, 32, 32) });
            } catch {}
        }
    } else {
        const dir = TEMPLATE_DIRS[source];
        if (!fs.existsSync(dir)) return templates;

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        for (const file of files) {
            const itemId = file.replace('.png', '');
            try {
                const img = await loadImage(path.join(dir, file));
                const canvas = createCanvas(32, 32);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 32, 32);
                templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
            } catch {}
        }
    }

    return templates;
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

async function testTemplates(templateSource, templates) {
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    let totalTP = 0, totalFP = 0, totalFN = 0;
    const threshold = 0.55;

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

        // Detect items
        const detectedCounts = new Map();

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

            // Check if cell is empty
            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;
            if (variance < 350) continue;

            // Resize and match
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null, bestScore = 0;
            for (const [itemId, template] of templates) {
                const score = calculateNCC(resizedCell, template.imageData);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = itemId;
                }
            }

            if (bestMatch && bestScore >= threshold) {
                detectedCounts.set(bestMatch, (detectedCounts.get(bestMatch) || 0) + 1);
            }
        }

        // Calculate TP, FP, FN for this image
        for (const [item, expected] of expectedCounts) {
            const detected = detectedCounts.get(item) || 0;
            const tp = Math.min(expected, detected);
            const fn = expected - tp;
            totalTP += tp;
            totalFN += fn;
        }

        for (const [item, detected] of detectedCounts) {
            const expected = expectedCounts.get(item) || 0;
            const fp = Math.max(0, detected - expected);
            totalFP += fp;
        }
    }

    const precision = totalTP / (totalTP + totalFP) || 0;
    const recall = totalTP / (totalTP + totalFN) || 0;
    const f1 = 2 * precision * recall / (precision + recall) || 0;

    return {
        source: templateSource,
        templateCount: templates.size,
        truePositives: totalTP,
        falsePositives: totalFP,
        falseNegatives: totalFN,
        precision: precision * 100,
        recall: recall * 100,
        f1: f1 * 100
    };
}

async function main() {
    console.log('=== Template Comparison Test ===\n');

    const results = [];

    // Test each template source
    for (const source of ['wiki', 'v1', 'v2']) {
        console.log(`Loading ${source} templates...`);
        const templates = await loadTemplates(source);
        if (templates.size === 0) {
            console.log(`  No templates found for ${source}, skipping\n`);
            continue;
        }
        console.log(`  Loaded ${templates.size} templates`);

        console.log(`Testing ${source}...`);
        const result = await testTemplates(source, templates);
        results.push(result);
        console.log(`  Done\n`);
    }

    // Display results
    console.log('=== Results ===\n');
    console.log('| Source | Templates | TP | FP | FN | Precision | Recall | F1 Score |');
    console.log('|--------|-----------|----|----|----|-----------:|-------:|---------:|');

    for (const r of results) {
        console.log(`| ${r.source.padEnd(6)} | ${String(r.templateCount).padStart(9)} | ${String(r.truePositives).padStart(2)} | ${String(r.falsePositives).padStart(2)} | ${String(r.falseNegatives).padStart(2)} | ${r.precision.toFixed(1).padStart(9)}% | ${r.recall.toFixed(1).padStart(5)}% | ${r.f1.toFixed(1).padStart(7)}% |`);
    }

    console.log('|--------|-----------|----|----|----|-----------:|-------:|---------:|');

    // Show improvement
    if (results.length >= 2) {
        const first = results[0];
        const last = results[results.length - 1];
        const improvement = last.f1 - first.f1;
        console.log(`\nF1 improvement from ${first.source} to ${last.source}: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    }
}

main().catch(console.error);
