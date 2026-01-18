#!/usr/bin/env node
// Extract templates from end-game summary screen (steam_05.jpg)
// The summary screen has larger, clearer item icons in an 8-column grid

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const SUMMARY_IMAGE = './test-images/gameplay/steam-community/steam_05.jpg';
const OUTPUT_DIR = './test-results/summary-templates';

async function main() {
    console.log('=== Summary Screen Template Extractor ===\n');

    const image = await loadImage(SUMMARY_IMAGE);
    console.log(`Image size: ${image.width}x${image.height}`);

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // For 2560x1440 resolution:
    // - Inventory area starts at approximately x=858
    // - First item row at y=608
    // - Icon size: ~70x70 pixels
    // - 8 columns, 5 rows of items
    // - Cell width ~86 (icon + spacing), cell height ~84

    const gridConfig = {
        startX: 858,
        startY: 608,
        iconSize: 70,
        cols: 8,
        rows: 5,
        spacingX: 16,
        spacingY: 84  // Vertical spacing including count label area
    };

    // Item names from ground truth (row by row, left to right)
    const itemNames = [
        // Row 1
        ['feathers', 'milk', 'ice-cube', 'wrench', 'honeycomb', 'backpack', 'borgar', 'ice-crystal'],
        // Row 2
        ['moldy-cheese', 'golden-sneakers', 'demonic-soul', 'sucky-magnet', 'time-bracelet', 'forbidden-juice', 'medkit', 'spiky-shield'],
        // Row 3
        ['cursed-doll', 'campfire', 'pink-blob', 'ghost', 'turbo-skates', 'credit-card-red', 'unknown-1', 'unknown-2'],
        // Row 4 (may be empty or partial)
        ['unknown-3', 'unknown-4', 'unknown-5', 'unknown-6', 'unknown-7', 'unknown-8', 'unknown-9', 'unknown-10'],
        // Row 5
        ['unknown-11', 'unknown-12', 'unknown-13', 'unknown-14', 'unknown-15', 'unknown-16', 'unknown-17', 'unknown-18']
    ];

    console.log(`\nExtracting ${gridConfig.cols}x${gridConfig.rows} grid...`);
    console.log(`Grid config: startX=${gridConfig.startX}, startY=${gridConfig.startY}, iconSize=${gridConfig.iconSize}\n`);

    let extracted = 0;

    for (let row = 0; row < gridConfig.rows; row++) {
        for (let col = 0; col < gridConfig.cols; col++) {
            const x = gridConfig.startX + col * (gridConfig.iconSize + gridConfig.spacingX);
            const y = gridConfig.startY + row * gridConfig.spacingY;

            // Extract cell
            const cellData = ctx.getImageData(x, y, gridConfig.iconSize, gridConfig.iconSize);

            // Check if cell has content (variance check)
            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;

            if (variance < 200) {
                console.log(`  [${row},${col}] Empty (var=${variance.toFixed(0)})`);
                continue;
            }

            // Get item name
            const itemName = itemNames[row]?.[col] || `unknown-${row}-${col}`;

            // Save at 32x32 (standard template size)
            const outCanvas = createCanvas(32, 32);
            const outCtx = outCanvas.getContext('2d');
            const srcCanvas = createCanvas(gridConfig.iconSize, gridConfig.iconSize);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            outCtx.drawImage(srcCanvas, 0, 0, 32, 32);

            const outPath = path.join(OUTPUT_DIR, `${itemName}.png`);
            const buffer = outCanvas.toBuffer('image/png');
            fs.writeFileSync(outPath, buffer);

            console.log(`  [${row},${col}] ${itemName} (var=${variance.toFixed(0)}) -> ${outPath}`);
            extracted++;
        }
    }

    console.log(`\nExtracted ${extracted} templates to ${OUTPUT_DIR}`);

    // Also extract debug grid overlay
    const debugCanvas = createCanvas(image.width, image.height);
    const debugCtx = debugCanvas.getContext('2d');
    debugCtx.drawImage(image, 0, 0);
    debugCtx.strokeStyle = 'lime';
    debugCtx.lineWidth = 1;

    for (let row = 0; row < gridConfig.rows; row++) {
        for (let col = 0; col < gridConfig.cols; col++) {
            const x = gridConfig.startX + col * (gridConfig.iconSize + gridConfig.spacingX);
            const y = gridConfig.startY + row * gridConfig.spacingY;
            debugCtx.strokeRect(x, y, gridConfig.iconSize, gridConfig.iconSize);
        }
    }

    const debugPath = path.join(OUTPUT_DIR, '_debug_grid.png');
    fs.writeFileSync(debugPath, debugCanvas.toBuffer('image/png'));
    console.log(`\nDebug grid saved to: ${debugPath}`);
}

main().catch(console.error);
