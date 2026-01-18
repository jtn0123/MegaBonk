#!/usr/bin/env node
// Calibrated grid detection based on actual UI measurements

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/grid-calibrated';

// Calibrated parameters based on UI measurement
// Reference: 720p height
const GRID_PARAMS = {
    // Icon size at 720p - inventory icons are ~32-36px
    iconSizeBase: 34,

    // Spacing between icons at 720p
    spacingBase: 4,

    // Bottom margin at 720p - skip weapon bar (~40px) + small gap
    // First inventory row starts ~45px from bottom at 720p
    bottomMarginBase: 42,

    // Row height (icon + gap between rows)
    rowHeightBase: 40,

    // How many rows to detect
    maxRows: 3,

    // Minimum Y position as % of height (allow up to top 30% of screen)
    minYPercent: 0.70,

    // Side margins - items are centered, ~70% width used
    sideMarginPercent: 0.15
};

function detectGridCalibrated(width, height) {
    const scale = height / 720;

    const iconSize = Math.round(GRID_PARAMS.iconSizeBase * scale);
    const spacing = Math.round(GRID_PARAMS.spacingBase * scale);
    const bottomMargin = Math.round(GRID_PARAMS.bottomMarginBase * scale);
    const rowHeight = Math.round(GRID_PARAMS.rowHeightBase * scale);

    const positions = [];

    // Calculate row Y positions (from bottom up)
    const rowYPositions = [];
    for (let row = 0; row < GRID_PARAMS.maxRows; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * GRID_PARAMS.minYPercent) {
            rowYPositions.push(y);
        }
    }

    // Calculate horizontal positions
    const sideMargin = Math.round(width * GRID_PARAMS.sideMarginPercent);
    const usableWidth = width - sideMargin * 2;
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / cellWidth));

    // Center the items
    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({
                x: startX + i * cellWidth,
                y: rowY,
                width: iconSize,
                height: iconSize,
                row: rowYPositions.indexOf(rowY),
                col: i
            });
        }
    }

    return {
        positions,
        params: { iconSize, spacing, bottomMargin, rowHeight, scale, rowYPositions }
    };
}

function isEmptyCell(ctx, x, y, w, h) {
    if (x < 0 || y < 0) return true;
    const imageData = ctx.getImageData(x, y, w, h);
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    // Item cells have high variance (texture), empty ones are flat
    return variance < 350 || mean < 30;
}

async function analyzeAndVisualize(imagePath, expectedItems) {
    const image = await loadImage(imagePath);
    const { positions, params } = detectGridCalibrated(image.width, image.height);

    // Analyze
    const srcCanvas = createCanvas(image.width, image.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(image, 0, 0);

    let nonEmpty = 0;
    const cellResults = [];
    for (const cell of positions) {
        const empty = isEmptyCell(srcCtx, cell.x, cell.y, cell.width, cell.height);
        if (!empty) nonEmpty++;
        cellResults.push({ ...cell, empty });
    }

    // Visualize
    const canvas = createCanvas(image.width, image.height + 80);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    for (const cell of cellResults) {
        ctx.strokeStyle = cell.empty ? 'rgba(100, 100, 255, 0.3)' : 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = cell.empty ? 1 : 2;
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
    }

    // Info panel
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, image.height, image.width, 80);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';

    const info = [
        `Calibrated: iconSize=${params.iconSize}, bottomMargin=${params.bottomMargin}, rowHeight=${params.rowHeight}`,
        `Detected: ${nonEmpty} non-empty / ${positions.length} cells | Expected: ${expectedItems} | Diff: ${nonEmpty - expectedItems}`,
        `Rows at Y: ${params.rowYPositions.map(y => Math.round(y)).join(', ')} (${params.rowYPositions.length} rows)`
    ];
    info.forEach((line, i) => ctx.fillText(line, 10, image.height + 18 + i * 18));

    return {
        canvas,
        stats: {
            width: image.width,
            height: image.height,
            nonEmpty,
            expected: expectedItems,
            diff: nonEmpty - expectedItems,
            params
        }
    };
}

async function main() {
    console.log('=== Calibrated Grid Detection ===\n');
    console.log('Parameters:', GRID_PARAMS);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('\n| Image | Resolution | Scale | Detected | Expected | Diff |');
    console.log('|-------|------------|-------|----------|----------|------|');

    let totalDetected = 0, totalExpected = 0;

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        const result = await analyzeAndVisualize(imagePath, data.items.length);

        // Save visualization
        const outputPath = path.join(OUTPUT_DIR, `grid_${name.replace(/[\/\.]/g, '_')}.png`);
        fs.writeFileSync(outputPath, result.canvas.toBuffer('image/png'));

        const shortName = name.slice(9, 35);
        const diff = result.stats.diff;
        const diffStr = (diff >= 0 ? '+' : '') + diff;
        console.log(`| ${shortName.padEnd(25)} | ${result.stats.width}x${result.stats.height} | ${result.stats.params.scale.toFixed(2)} | ${String(result.stats.nonEmpty).padStart(8)} | ${String(result.stats.expected).padStart(8)} | ${diffStr.padStart(4)} |`);

        totalDetected += result.stats.nonEmpty;
        totalExpected += result.stats.expected;
    }

    console.log('|-------|------------|-------|----------|----------|------|');
    const totalDiff = totalDetected - totalExpected;
    console.log(`| TOTAL |            |       | ${String(totalDetected).padStart(8)} | ${String(totalExpected).padStart(8)} | ${(totalDiff >= 0 ? '+' : '') + totalDiff} |`);

    console.log(`\nVisualization saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
