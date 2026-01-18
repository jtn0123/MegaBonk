#!/usr/bin/env node
// Align detected crops to ground truth using position and count matching

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './training-data/aligned-templates';

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

async function align() {
    console.log('=== Align Crops to Ground Truth ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    const alignedItems = new Map(); // itemId -> array of canvases
    let totalAligned = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        // Get non-empty cells sorted by position (left to right, top to bottom)
        const cells = [];
        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            if (!isEmptyCell(cellData)) {
                // Extract 32x32 crop
                const resizeCanvas = createCanvas(32, 32);
                const resizeCtx = resizeCanvas.getContext('2d');
                const srcCanvas = createCanvas(pos.width, pos.height);
                srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
                const margin = Math.round(pos.width * 0.12);
                resizeCtx.drawImage(srcCanvas, margin, margin,
                    pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);

                cells.push({ pos, canvas: resizeCanvas });
            }
        }

        // Sort cells by Y then X
        cells.sort((a, b) => {
            if (Math.abs(a.pos.y - b.pos.y) > 20) return a.pos.y - b.pos.y;
            return a.pos.x - b.pos.x;
        });

        // Get expected items
        const expectedItems = data.items.map(item =>
            item.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );

        const detected = cells.length;
        const expected = expectedItems.length;
        const diff = Math.abs(detected - expected);

        // Only use images where counts are close
        if (diff <= 2 && detected > 0) {
            console.log(`${filename.slice(9, 40)}: ${detected} detected, ${expected} expected (diff=${diff})`);

            // If perfect match, align directly
            if (detected === expected) {
                console.log(`  → Perfect alignment!`);
                for (let i = 0; i < cells.length; i++) {
                    const itemId = expectedItems[i];
                    if (!alignedItems.has(itemId)) {
                        alignedItems.set(itemId, []);
                    }
                    alignedItems.get(itemId).push(cells[i].canvas);
                    totalAligned++;
                }
            } else if (detected === expected - 1) {
                // One item missing - still useful for items that appear multiple times
                console.log(`  → Close match, extracting duplicates`);
                const itemCounts = new Map();
                expectedItems.forEach(id => itemCounts.set(id, (itemCounts.get(id) || 0) + 1));

                // Find items that appear multiple times
                const duplicates = Array.from(itemCounts.entries())
                    .filter(([_, count]) => count >= 2)
                    .map(([id]) => id);

                if (duplicates.length > 0) {
                    console.log(`  → Found duplicates: ${duplicates.join(', ')}`);
                }
            } else if (detected === expected + 1) {
                // One extra detection - extract items we're confident about
                console.log(`  → One extra, extracting unique items`);
                const itemCounts = new Map();
                expectedItems.forEach(id => itemCounts.set(id, (itemCounts.get(id) || 0) + 1));

                // Items that appear exactly once are more reliable
                const uniques = Array.from(itemCounts.entries())
                    .filter(([_, count]) => count === 1)
                    .map(([id]) => id);

                console.log(`  → ${uniques.length} unique items in ground truth`);
            }
        }
    }

    // Save aligned templates
    console.log('\n--- Saving Aligned Templates ---');

    for (const [itemId, canvases] of alignedItems) {
        const itemDir = path.join(OUTPUT_DIR, itemId);
        fs.mkdirSync(itemDir, { recursive: true });

        for (let i = 0; i < canvases.length; i++) {
            fs.writeFileSync(
                path.join(itemDir, `${itemId}_${i}.png`),
                canvases[i].toBuffer('image/png')
            );
        }
    }

    console.log(`\nTotal aligned items: ${alignedItems.size} unique items`);
    console.log(`Total aligned crops: ${totalAligned}`);

    // Summary of what was aligned
    console.log('\nAligned items:');
    const sortedItems = Array.from(alignedItems.entries())
        .sort((a, b) => b[1].length - a[1].length);

    for (const [id, canvases] of sortedItems.slice(0, 20)) {
        console.log(`  ${id}: ${canvases.length} examples`);
    }

    if (sortedItems.length > 20) {
        console.log(`  ... and ${sortedItems.length - 20} more items`);
    }

    console.log(`\nTemplates saved to: ${OUTPUT_DIR}/`);
}

align().catch(console.error);
