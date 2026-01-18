#!/usr/bin/env node
// Test if in-game style augmented templates improve matching

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const AUGMENTED_DIR = './training-data/ingame-style-templates/by-item';

function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    const rowYPositions = [];
    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * 0.70) rowYPositions.push(y);
    }

    const sideMargin = Math.round(width * 0.15);
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor((width - sideMargin * 2) / cellWidth));
    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function isEmptyCell(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 350 || mean < 30;
}

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

async function loadAugmentedTemplates() {
    const templates = new Map(); // itemId -> array of ImageData

    if (!fs.existsSync(AUGMENTED_DIR)) {
        console.log('No augmented templates found');
        return templates;
    }

    const itemDirs = fs.readdirSync(AUGMENTED_DIR);
    for (const itemId of itemDirs) {
        const itemDir = path.join(AUGMENTED_DIR, itemId);
        if (!fs.statSync(itemDir).isDirectory()) continue;

        const files = fs.readdirSync(itemDir).filter(f => f.endsWith('.png'));
        const variants = [];

        for (const file of files) {
            const img = await loadImage(path.join(itemDir, file));
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            variants.push(ctx.getImageData(0, 0, 32, 32));
        }

        if (variants.length > 0) {
            templates.set(itemId, variants);
        }
    }

    return templates;
}

async function loadOriginalTemplates() {
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
    const templates = new Map();

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
            templates.set(item.id, [ctx.getImageData(0, 0, 32, 32)]);
        } catch {}
    }

    return templates;
}

async function runTest(templates, name) {
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

        // Ground truth
        const truth = new Map();
        data.items.forEach(item => {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            truth.set(id, (truth.get(id) || 0) + 1);
        });

        // Detect and match
        const detections = new Map();

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            if (isEmptyCell(cellData)) continue;

            // Resize cell
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            // Match against all template variants
            let bestMatch = null;
            let bestScore = 0;

            for (const [itemId, variants] of templates) {
                for (const templateData of variants) {
                    const score = calculateNCC(resizedCell, templateData);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = itemId;
                    }
                }
            }

            if (bestMatch && bestScore >= 0.45) {
                detections.set(bestMatch, (detections.get(bestMatch) || 0) + 1);
            }
        }

        // Calculate metrics
        let tp = 0, fp = 0, fn = 0;
        detections.forEach((count, id) => {
            const expected = truth.get(id) || 0;
            tp += Math.min(count, expected);
            if (count > expected) fp += count - expected;
        });
        truth.forEach((count, id) => {
            const detected = detections.get(id) || 0;
            if (detected < count) fn += count - detected;
        });

        totalTP += tp;
        totalFP += fp;
        totalFN += fn;
    }

    const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
    const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    return { name, precision, recall, f1, tp: totalTP, fp: totalFP, fn: totalFN };
}

async function main() {
    console.log('=== Testing Augmented Template Matching ===\n');

    // Load both template sets
    console.log('Loading templates...');
    const originalTemplates = await loadOriginalTemplates();
    const augmentedTemplates = await loadAugmentedTemplates();

    console.log(`Original: ${originalTemplates.size} items`);
    console.log(`Augmented: ${augmentedTemplates.size} items with multiple variants\n`);

    // Test both
    console.log('Testing original templates...');
    const originalResult = await runTest(originalTemplates, 'Original (wiki)');

    console.log('Testing augmented templates...');
    const augmentedResult = await runTest(augmentedTemplates, 'Augmented (in-game style)');

    // Combined: use both original and augmented
    const combinedTemplates = new Map();
    for (const [id, variants] of originalTemplates) {
        combinedTemplates.set(id, [...variants]);
    }
    for (const [id, variants] of augmentedTemplates) {
        if (combinedTemplates.has(id)) {
            combinedTemplates.get(id).push(...variants);
        } else {
            combinedTemplates.set(id, [...variants]);
        }
    }

    console.log('Testing combined templates...');
    const combinedResult = await runTest(combinedTemplates, 'Combined (orig + aug)');

    // Results
    console.log('\n' + '='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));
    console.log('| Template Set                 | Precision | Recall  | F1 Score |');
    console.log('|------------------------------|-----------|---------|----------|');

    for (const r of [originalResult, augmentedResult, combinedResult]) {
        console.log(`| ${r.name.padEnd(28)} | ${(r.precision*100).toFixed(1).padStart(8)}% | ${(r.recall*100).toFixed(1).padStart(6)}% | ${(r.f1*100).toFixed(1).padStart(7)}% |`);
    }

    console.log('|------------------------------|-----------|---------|----------|');

    // Compare
    const improvement = ((augmentedResult.f1 - originalResult.f1) / originalResult.f1 * 100);
    console.log(`\nAugmented vs Original: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}% F1 change`);

    const combinedImprovement = ((combinedResult.f1 - originalResult.f1) / originalResult.f1 * 100);
    console.log(`Combined vs Original: ${combinedImprovement >= 0 ? '+' : ''}${combinedImprovement.toFixed(1)}% F1 change`);
}

main().catch(console.error);
