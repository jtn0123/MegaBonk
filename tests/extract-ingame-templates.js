#!/usr/bin/env node
// Extract actual in-game item appearances to create a reference library
// Uses ground truth to know which items are in each screenshot

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './training-data/ingame-templates';

// Calibrated grid detection
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

function getCellStats(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    let sumR = 0, sumG = 0, sumB = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
        sumR += imageData.data[i];
        sumG += imageData.data[i+1];
        sumB += imageData.data[i+2];
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const isEmpty = variance < 350 || mean < 30;

    return {
        isEmpty,
        variance,
        mean,
        avgColor: { r: sumR / count, g: sumG / count, b: sumB / count }
    };
}

// Extract center portion of cell (remove border artifacts)
function extractCenter(ctx, x, y, w, h, outputSize) {
    const margin = Math.round(w * 0.12);
    const srcCanvas = createCanvas(w, h);
    const srcCtx = srcCanvas.getContext('2d');
    const cellData = ctx.getImageData(x, y, w, h);
    srcCtx.putImageData(cellData, 0, 0);

    const dstCanvas = createCanvas(outputSize, outputSize);
    const dstCtx = dstCanvas.getContext('2d');
    dstCtx.drawImage(srcCanvas, margin, margin, w - margin*2, h - margin*2,
                     0, 0, outputSize, outputSize);
    return dstCanvas;
}

async function extract() {
    console.log('=== Extracting In-Game Templates ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Track extracted items
    const itemExamples = new Map(); // itemId -> array of crops

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        console.log(`Processing: ${name}`);

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        // Get list of expected items
        const expectedItems = data.items.map(item =>
            item.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );

        // Find non-empty cells
        const nonEmptyCells = [];
        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            const stats = getCellStats(cellData);
            if (!stats.isEmpty) {
                nonEmptyCells.push({ ...pos, stats, cellData });
            }
        }

        console.log(`  Found ${nonEmptyCells.length} non-empty cells, expected ${expectedItems.length} items`);

        // If counts roughly match, we can try to pair them
        // Sort cells by position (left to right, top to bottom)
        nonEmptyCells.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 20) return a.y - b.y;
            return a.x - b.x;
        });

        // If we have the same number of cells as expected items, pair them
        if (nonEmptyCells.length === expectedItems.length) {
            console.log(`  Perfect match! Extracting labeled crops...`);

            for (let i = 0; i < nonEmptyCells.length; i++) {
                const cell = nonEmptyCells[i];
                const itemId = expectedItems[i];

                // Extract and normalize to 48x48
                const cropCanvas = extractCenter(ctx, cell.x, cell.y, cell.width, cell.height, 48);

                if (!itemExamples.has(itemId)) {
                    itemExamples.set(itemId, []);
                }
                itemExamples.get(itemId).push({
                    canvas: cropCanvas,
                    source: name,
                    stats: cell.stats
                });
            }
        } else {
            // Extract all cells as "unlabeled" for potential manual review
            console.log(`  Count mismatch (${nonEmptyCells.length} vs ${expectedItems.length}), extracting for review...`);

            for (let i = 0; i < nonEmptyCells.length; i++) {
                const cell = nonEmptyCells[i];
                const cropCanvas = extractCenter(ctx, cell.x, cell.y, cell.width, cell.height, 48);

                if (!itemExamples.has('_unlabeled')) {
                    itemExamples.set('_unlabeled', []);
                }
                itemExamples.get('_unlabeled').push({
                    canvas: cropCanvas,
                    source: name,
                    stats: cell.stats,
                    expectedItems: expectedItems.slice() // Keep reference for manual review
                });
            }
        }
    }

    // Save extracted templates
    console.log('\nSaving extracted templates...');

    const summary = { items: {}, unlabeled: 0 };

    for (const [itemId, examples] of itemExamples) {
        if (itemId === '_unlabeled') {
            // Save unlabeled for review
            const unlabeledDir = path.join(OUTPUT_DIR, '_unlabeled');
            fs.mkdirSync(unlabeledDir, { recursive: true });

            for (let i = 0; i < examples.length; i++) {
                const filename = `unlabeled_${i}.png`;
                fs.writeFileSync(
                    path.join(unlabeledDir, filename),
                    examples[i].canvas.toBuffer('image/png')
                );
            }
            summary.unlabeled = examples.length;
        } else {
            // Save labeled item
            const itemDir = path.join(OUTPUT_DIR, itemId);
            fs.mkdirSync(itemDir, { recursive: true });

            for (let i = 0; i < examples.length; i++) {
                const filename = `${itemId}_${i}.png`;
                fs.writeFileSync(
                    path.join(itemDir, filename),
                    examples[i].canvas.toBuffer('image/png')
                );
            }
            summary.items[itemId] = examples.length;
        }
    }

    // Create summary
    console.log('\n' + '='.repeat(60));
    console.log('EXTRACTION SUMMARY');
    console.log('='.repeat(60));

    const labeledCount = Object.keys(summary.items).length;
    const totalLabeled = Object.values(summary.items).reduce((a, b) => a + b, 0);

    console.log(`\nLabeled items: ${labeledCount} unique items, ${totalLabeled} total crops`);
    console.log(`Unlabeled crops: ${summary.unlabeled}`);

    // Show items with multiple examples
    console.log('\nItems with multiple examples (best for training):');
    const multiExample = Object.entries(summary.items)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1]);

    for (const [id, count] of multiExample.slice(0, 15)) {
        console.log(`  ${id}: ${count} examples`);
    }

    // Save summary JSON
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'summary.json'),
        JSON.stringify(summary, null, 2)
    );

    console.log(`\nTemplates saved to: ${OUTPUT_DIR}/`);

    // Create montage of all extracted items for visual review
    await createMontage(itemExamples);
}

async function createMontage(itemExamples) {
    const labeled = Array.from(itemExamples.entries())
        .filter(([id]) => id !== '_unlabeled')
        .flatMap(([id, examples]) =>
            examples.map((e, i) => ({ id, canvas: e.canvas, idx: i }))
        );

    if (labeled.length === 0) {
        console.log('No labeled items to create montage');
        return;
    }

    const cols = 10;
    const rows = Math.ceil(labeled.length / cols);
    const cellSize = 52;
    const padding = 2;

    const montage = createCanvas(cols * cellSize, rows * cellSize);
    const ctx = montage.getContext('2d');
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, montage.width, montage.height);

    for (let i = 0; i < labeled.length; i++) {
        const item = labeled[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellSize + padding;
        const y = row * cellSize + padding;

        ctx.drawImage(item.canvas, x, y, cellSize - padding*2, cellSize - padding*2);

        // Label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y + cellSize - padding*2 - 10, cellSize - padding*2, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '7px monospace';
        ctx.fillText(item.id.slice(0, 8), x + 1, y + cellSize - padding*2 - 2);
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'montage.png'),
        montage.toBuffer('image/png')
    );
    console.log(`Montage saved: ${OUTPUT_DIR}/montage.png`);
}

extract().catch(console.error);
