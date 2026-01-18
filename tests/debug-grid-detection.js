#!/usr/bin/env node
// Debug grid detection - visualize where we're detecting cells vs actual items

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/grid-debug';

// Current grid detection (from CV runner)
function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(40 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(20 * scale);
    const positions = [];
    const rowHeight = iconSize + spacing;

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * 0.20);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.75) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({
                x: startX + i * (iconSize + spacing),
                y: rowY,
                width: iconSize,
                height: iconSize,
                row: rowYPositions.indexOf(rowY),
                col: i
            });
        }
    }
    return { positions, iconSize, spacing, bottomMargin, scale };
}

// Empty cell detection
function isEmptyCell(ctx, x, y, w, h) {
    const imageData = ctx.getImageData(x, y, w, h);
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return { isEmpty: variance < 300 || mean < 40, variance, mean };
}

async function analyzeImage(imagePath, expectedItems) {
    const image = await loadImage(imagePath);
    const { positions, iconSize, spacing, bottomMargin, scale } = detectGridPositions(image.width, image.height);

    // Create debug canvas
    const canvas = createCanvas(image.width, image.height + 150);
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Analyze each cell
    const srcCanvas = createCanvas(image.width, image.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(image, 0, 0);

    let emptyCount = 0;
    let nonEmptyCount = 0;
    const cellStats = [];

    for (const cell of positions) {
        const { isEmpty, variance, mean } = isEmptyCell(srcCtx, cell.x, cell.y, cell.width, cell.height);

        if (isEmpty) {
            emptyCount++;
            // Draw empty cells in blue (transparent)
            ctx.strokeStyle = 'rgba(0, 100, 255, 0.3)';
            ctx.lineWidth = 1;
        } else {
            nonEmptyCount++;
            // Draw non-empty cells in green
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 2;
        }

        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
        cellStats.push({ ...cell, isEmpty, variance, mean });
    }

    // Draw info panel at bottom
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, image.height, image.width, 150);

    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';

    const info = [
        `Image: ${image.width}x${image.height} | Scale: ${scale.toFixed(2)}`,
        `Grid: iconSize=${iconSize}px, spacing=${spacing}px, bottomMargin=${bottomMargin}px`,
        `Cells detected: ${positions.length} (${nonEmptyCount} non-empty, ${emptyCount} empty)`,
        `Expected items: ${expectedItems}`,
        `Mismatch: ${nonEmptyCount - expectedItems} (${nonEmptyCount > expectedItems ? 'too many' : 'too few'} detections)`,
    ];

    info.forEach((line, i) => {
        ctx.fillText(line, 10, image.height + 20 + i * 20);
    });

    // Color legend
    ctx.fillStyle = '#0f0';
    ctx.fillRect(10, image.height + 120, 15, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText('Non-empty cell', 30, image.height + 132);

    ctx.fillStyle = 'rgba(0, 100, 255, 0.5)';
    ctx.fillRect(200, image.height + 120, 15, 15);
    ctx.fillStyle = '#fff';
    ctx.fillText('Empty cell', 220, image.height + 132);

    return {
        canvas,
        stats: {
            width: image.width,
            height: image.height,
            scale,
            iconSize,
            totalCells: positions.length,
            nonEmpty: nonEmptyCount,
            empty: emptyCount,
            expected: expectedItems,
            mismatch: nonEmptyCount - expectedItems
        },
        cellStats
    };
}

async function main() {
    console.log('=== Grid Detection Debug ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    const allStats = [];

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        console.log(`Analyzing: ${name}`);

        const result = await analyzeImage(imagePath, data.items.length);
        allStats.push({ name, ...result.stats });

        // Save debug image
        const outputPath = path.join(OUTPUT_DIR, `grid_${name.replace(/[\/\.]/g, '_')}.png`);
        const buffer = result.canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        console.log(`  Cells: ${result.stats.nonEmpty} detected vs ${result.stats.expected} expected (${result.stats.mismatch > 0 ? '+' : ''}${result.stats.mismatch})`);
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    console.log('\n| Image | Resolution | Scale | Detected | Expected | Mismatch |');
    console.log('|-------|------------|-------|----------|----------|----------|');

    let totalDetected = 0, totalExpected = 0;
    for (const s of allStats) {
        const shortName = s.name.slice(9, 35);
        console.log(`| ${shortName.padEnd(25)} | ${s.width}x${s.height} | ${s.scale.toFixed(2)} | ${String(s.nonEmpty).padStart(8)} | ${String(s.expected).padStart(8)} | ${(s.mismatch > 0 ? '+' : '') + s.mismatch} |`);
        totalDetected += s.nonEmpty;
        totalExpected += s.expected;
    }

    console.log('|-------|------------|-------|----------|----------|----------|');
    console.log(`| TOTAL |            |       | ${String(totalDetected).padStart(8)} | ${String(totalExpected).padStart(8)} | ${(totalDetected - totalExpected > 0 ? '+' : '') + (totalDetected - totalExpected)} |`);

    console.log(`\nDebug images saved to: ${OUTPUT_DIR}/`);

    // Analysis
    console.log('\n' + '='.repeat(70));
    console.log('ANALYSIS');
    console.log('='.repeat(70));

    const avgMismatch = (totalDetected - totalExpected) / allStats.length;
    console.log(`\nAverage mismatch: ${avgMismatch.toFixed(1)} cells per image`);

    if (totalDetected > totalExpected) {
        console.log('\nPROBLEM: Detecting too many cells as "non-empty"');
        console.log('Possible causes:');
        console.log('  1. Empty cell threshold too low (variance < 300)');
        console.log('  2. Grid extends into UI elements / non-inventory areas');
        console.log('  3. Background pixels being detected as content');
    } else {
        console.log('\nPROBLEM: Detecting too few cells');
        console.log('Possible causes:');
        console.log('  1. Grid not aligned with actual item positions');
        console.log('  2. Empty cell threshold too high');
    }
}

main().catch(console.error);
