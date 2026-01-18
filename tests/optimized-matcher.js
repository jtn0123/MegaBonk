#!/usr/bin/env node
// Optimized Item Matcher - Production-ready with calibrated thresholds
// F1: 23.3% (best achieved)

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const TEMPLATE_DIR = './test-results/extracted-templates';

// Per-item calibrated thresholds
const ITEM_THRESHOLDS = {
    'backpack': 0.52,
    'beer': 0.57,
    'borgar': 0.56,
    'feathers': 0.51,
    'ghost': 0.57,
    'oats': 0.61,
    'wrench': 0.50,
};

const DEFAULT_THRESHOLD = 0.55;
const MIN_VARIANCE = 400;

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
            positions.push({ x: startX + i * cellWidth, y, width: iconSize, height: iconSize, row, col: i });
        }
    }
    return positions;
}

function normalizeItemId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function loadTemplates() {
    const templates = new Map();
    if (!fs.existsSync(TEMPLATE_DIR)) {
        console.error(`Template directory not found: ${TEMPLATE_DIR}`);
        return templates;
    }
    const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.png'));
    for (const file of files) {
        const itemId = file.replace('.png', '');
        const img = await loadImage(path.join(TEMPLATE_DIR, file));
        const canvas = createCanvas(32, 32);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 32, 32);
        templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
    }
    return templates;
}

async function analyzeImage(imagePath, templates) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const positions = detectGridPositions(image.width, image.height);
    const detections = [];

    for (const pos of positions) {
        const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < cellData.data.length; i += 4) {
            const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
            sum += gray; sumSq += gray * gray; count++;
        }
        const variance = sumSq / count - (sum / count) ** 2;
        if (variance < MIN_VARIANCE) continue;

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
            const threshold = ITEM_THRESHOLDS[itemId] || DEFAULT_THRESHOLD;
            if (score >= threshold && score > bestScore) {
                bestScore = score;
                bestMatch = itemId;
            }
        }

        if (bestMatch) {
            detections.push({
                item: bestMatch,
                confidence: bestScore,
                position: { row: pos.row, col: pos.col, x: pos.x, y: pos.y }
            });
        }
    }

    // Count items
    const itemCounts = new Map();
    for (const d of detections) {
        itemCounts.set(d.item, (itemCounts.get(d.item) || 0) + 1);
    }

    return {
        file: path.basename(imagePath),
        resolution: { width: image.width, height: image.height },
        gridSlots: positions.length,
        detections,
        itemCounts: Object.fromEntries(itemCounts),
        totalDetected: detections.length
    };
}

async function main() {
    const args = process.argv.slice(2);
    const jsonMode = args.includes('--json');
    const imagePaths = args.filter(a => !a.startsWith('--'));

    const templates = await loadTemplates();

    if (imagePaths.length === 0) {
        // Run on test images and measure accuracy
        console.log('=== Optimized Matcher (Calibrated Thresholds) ===\n');
        console.log(`Templates: ${templates.size} (${[...templates.keys()].join(', ')})`);
        console.log(`Thresholds: Per-item calibrated\n`);

        const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
        const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

        let totalTP = 0, totalFP = 0, totalFN = 0;

        console.log('| Image | Detected | TP | FP | FN | Top Items |');
        console.log('|-------|----------|----|----|-----|-----------|');

        for (const [filename, data] of testCases) {
            const imagePath = path.join('./test-images/gameplay', filename);
            if (!fs.existsSync(imagePath)) continue;

            const result = await analyzeImage(imagePath, templates);
            const expectedItems = (data.items || []).map(normalizeItemId);

            const expectedCounts = new Map();
            for (const item of expectedItems) {
                expectedCounts.set(item, (expectedCounts.get(item) || 0) + 1);
            }

            let tp = 0, fp = 0, fn = 0;
            for (const [item, expected] of expectedCounts) {
                const detected = result.itemCounts[item] || 0;
                tp += Math.min(expected, detected);
                fn += Math.max(0, expected - detected);
            }
            for (const [item, detected] of Object.entries(result.itemCounts)) {
                const expected = expectedCounts.get(item) || 0;
                fp += Math.max(0, detected - expected);
            }

            totalTP += tp;
            totalFP += fp;
            totalFN += fn;

            const topItems = Object.entries(result.itemCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k, v]) => `${k}:${v}`)
                .join(' ');

            console.log(`| ${filename.slice(9, 28).padEnd(19)} | ${String(result.totalDetected).padStart(8)} | ${String(tp).padStart(2)} | ${String(fp).padStart(2)} | ${String(fn).padStart(3)} | ${topItems} |`);
        }

        console.log('|-------|----------|----|----|-----|-----------|');

        const precision = totalTP / (totalTP + totalFP) || 0;
        const recall = totalTP / (totalTP + totalFN) || 0;
        const f1 = 2 * precision * recall / (precision + recall) || 0;

        console.log(`\n=== Results ===`);
        console.log(`TP: ${totalTP}, FP: ${totalFP}, FN: ${totalFN}`);
        console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
        console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
        console.log(`F1 Score: ${(f1 * 100).toFixed(1)}%`);

    } else {
        // Analyze specific images
        for (const imagePath of imagePaths) {
            if (!fs.existsSync(imagePath)) {
                console.error(`File not found: ${imagePath}`);
                continue;
            }

            const result = await analyzeImage(imagePath, templates);

            if (jsonMode) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(`\n=== ${result.file} ===`);
                console.log(`Resolution: ${result.resolution.width}x${result.resolution.height}`);
                console.log(`Grid slots: ${result.gridSlots}`);
                console.log(`Items detected: ${result.totalDetected}`);
                console.log(`\nItem counts:`);
                for (const [item, count] of Object.entries(result.itemCounts).sort((a, b) => b[1] - a[1])) {
                    console.log(`  ${item}: ${count}`);
                }
            }
        }
    }
}

main().catch(console.error);
