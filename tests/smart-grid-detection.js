#!/usr/bin/env node
// Smart grid detection - finds inventory region by background color

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/grid-smart';

// At 720p reference
const PARAMS = {
    iconSize: 34,
    spacing: 4,
    cellSize: 38,  // icon + spacing
    maxRows: 3,
    sideMargin: 0.15
};

// Find the actual inventory region by looking for rows with inventory-like content
function findInventoryRegion(ctx, width, height) {
    const scale = height / 720;

    // Inventory typically starts 40-80px from bottom at 720p
    // Scan in strips to find where the inventory background is
    const scanStart = Math.floor(height * 0.65);
    const scanEnd = height - 10;
    const stripHeight = Math.round(10 * scale);

    const stripData = [];

    for (let y = scanStart; y < scanEnd; y += stripHeight) {
        const strip = ctx.getImageData(0, y, width, stripHeight);

        // Look for inventory-like characteristics:
        // 1. Dark background (inventory slots are dark)
        // 2. Horizontal pattern of items (regularly spaced bright spots)

        // Sample the center 60% of the strip
        const centerStart = Math.floor(width * 0.2);
        const centerEnd = Math.floor(width * 0.8);

        let darkPixels = 0;
        let brightPixels = 0;
        let totalPixels = 0;

        for (let x = centerStart; x < centerEnd; x += 2) {
            for (let py = 0; py < stripHeight; py += 2) {
                const idx = (py * width + x) * 4;
                const r = strip.data[idx];
                const g = strip.data[idx + 1];
                const b = strip.data[idx + 2];
                const brightness = (r + g + b) / 3;

                totalPixels++;
                if (brightness < 60) darkPixels++;
                if (brightness > 150) brightPixels++;
            }
        }

        const darkRatio = darkPixels / totalPixels;
        const brightRatio = brightPixels / totalPixels;

        // Inventory rows have: some dark (background) and some bright (items)
        // Weapon bar has: mostly bright (big icons)
        // Empty areas have: mostly medium brightness

        const isInventoryLike = darkRatio > 0.2 && brightRatio > 0.05 && brightRatio < 0.5;

        stripData.push({
            y,
            darkRatio,
            brightRatio,
            isInventoryLike
        });
    }

    // Find contiguous inventory region
    let inventoryStart = null;
    let inventoryEnd = null;

    for (let i = stripData.length - 1; i >= 0; i--) {
        if (stripData[i].isInventoryLike) {
            if (inventoryEnd === null) {
                inventoryEnd = stripData[i].y + stripHeight;
            }
            inventoryStart = stripData[i].y;
        } else if (inventoryStart !== null) {
            // Gap found, stop
            break;
        }
    }

    return { inventoryStart, inventoryEnd, stripData, scale };
}

function detectGrid(ctx, width, height) {
    const scale = height / 720;
    const { inventoryStart, inventoryEnd, stripData } = findInventoryRegion(ctx, width, height);

    // Fall back to fixed positions if detection failed
    const actualStart = inventoryStart || Math.floor(height * 0.85);
    const actualEnd = inventoryEnd || height - Math.round(40 * scale);

    const iconSize = Math.round(PARAMS.iconSize * scale);
    const cellSize = Math.round(PARAMS.cellSize * scale);

    // Calculate how many rows fit in the detected region
    const regionHeight = actualEnd - actualStart;
    const numRows = Math.min(PARAMS.maxRows, Math.floor(regionHeight / cellSize));

    const positions = [];

    // Horizontal layout
    const sideMargin = Math.round(width * PARAMS.sideMargin);
    const usableWidth = width - sideMargin * 2;
    const maxCols = Math.min(20, Math.floor(usableWidth / cellSize));
    const totalWidth = maxCols * cellSize;
    const startX = Math.round((width - totalWidth) / 2);

    for (let row = 0; row < numRows; row++) {
        // Position rows from bottom of inventory region up
        const rowY = actualEnd - (row + 1) * cellSize;

        for (let col = 0; col < maxCols; col++) {
            positions.push({
                x: startX + col * cellSize,
                y: rowY,
                width: iconSize,
                height: iconSize,
                row, col
            });
        }
    }

    return {
        positions,
        params: { iconSize, cellSize, scale, numRows, inventoryStart: actualStart, inventoryEnd: actualEnd }
    };
}

function isEmptyCell(ctx, x, y, w, h) {
    if (x < 0 || y < 0) return true;
    const imageData = ctx.getImageData(Math.round(x), Math.round(y), w, h);
    let sum = 0, sumSq = 0, count = 0;
    let darkCount = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
        if (gray < 50) darkCount++;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const darkRatio = darkCount / count;

    // Empty slots: low variance OR very dark OR mostly dark background
    return variance < 400 || mean < 35 || darkRatio > 0.8;
}

async function analyze(imagePath, expectedItems) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const { positions, params } = detectGrid(ctx, image.width, image.height);

    let nonEmpty = 0;
    const cells = [];
    for (const pos of positions) {
        const empty = isEmptyCell(ctx, pos.x, pos.y, pos.width, pos.height);
        if (!empty) nonEmpty++;
        cells.push({ ...pos, empty });
    }

    // Create visualization
    const outCanvas = createCanvas(image.width, image.height + 80);
    const outCtx = outCanvas.getContext('2d');
    outCtx.drawImage(image, 0, 0);

    // Draw inventory region bounds
    outCtx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    outCtx.lineWidth = 2;
    outCtx.strokeRect(0, params.inventoryStart, image.width, params.inventoryEnd - params.inventoryStart);

    // Draw cells
    for (const cell of cells) {
        outCtx.strokeStyle = cell.empty ? 'rgba(100, 100, 255, 0.3)' : 'rgba(0, 255, 0, 0.9)';
        outCtx.lineWidth = cell.empty ? 1 : 2;
        outCtx.strokeRect(cell.x, cell.y, cell.width, cell.height);
    }

    // Info
    outCtx.fillStyle = '#1a1a2e';
    outCtx.fillRect(0, image.height, image.width, 80);
    outCtx.fillStyle = '#fff';
    outCtx.font = '11px monospace';
    outCtx.fillText(`Smart detection: ${nonEmpty} non-empty / ${positions.length} cells | Expected: ${expectedItems} | Diff: ${nonEmpty - expectedItems}`, 10, image.height + 20);
    outCtx.fillText(`Inventory region: Y=${params.inventoryStart}-${params.inventoryEnd} (${params.numRows} rows detected)`, 10, image.height + 40);

    return {
        canvas: outCanvas,
        stats: { width: image.width, height: image.height, nonEmpty, expected: expectedItems, diff: nonEmpty - expectedItems, params }
    };
}

async function main() {
    console.log('=== Smart Grid Detection ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Resolution | Detected | Expected | Diff |');
    console.log('|-------|------------|----------|----------|------|');

    let totalDetected = 0, totalExpected = 0;

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        const result = await analyze(imagePath, data.items.length);
        fs.writeFileSync(
            path.join(OUTPUT_DIR, `grid_${name.replace(/[\/\.]/g, '_')}.png`),
            result.canvas.toBuffer('image/png')
        );

        const shortName = name.slice(9, 35);
        const diff = result.stats.diff;
        console.log(`| ${shortName.padEnd(25)} | ${result.stats.width}x${result.stats.height} | ${String(result.stats.nonEmpty).padStart(8)} | ${String(result.stats.expected).padStart(8)} | ${(diff >= 0 ? '+' : '') + diff} |`);

        totalDetected += result.stats.nonEmpty;
        totalExpected += result.stats.expected;
    }

    console.log('|-------|------------|----------|----------|------|');
    const totalDiff = totalDetected - totalExpected;
    console.log(`| TOTAL |            | ${String(totalDetected).padStart(8)} | ${String(totalExpected).padStart(8)} | ${(totalDiff >= 0 ? '+' : '') + totalDiff} |`);

    console.log(`\nVisualization: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
