#!/usr/bin/env node
// Debug: Visualize grid positions and check if they align with actual items
import * as fs from 'fs';
import * as path from 'path';

let createCanvas: any, loadImage: any;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
} catch { process.exit(1); }

async function main() {
    const testCase = 'pc-1080p/level_21_english_desert_scorpion.jpg';
    const imagePath = path.join(__dirname, '../test-images/gameplay', testCase);

    const img = await loadImage(imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    console.log('═'.repeat(60));
    console.log(`IMAGE: ${testCase}`);
    console.log('═'.repeat(60));
    console.log(`Actual dimensions: ${img.width}x${img.height}`);

    const height = img.height;
    const width = img.width;

    // Grid calculations (same as offline-cv-runner)
    const iconSize = Math.round(40 * (height / 720));
    const spacing = Math.round(4 * (height / 720));
    const bottomMargin = Math.round(20 * (height / 720));
    const rowHeight = iconSize + spacing;

    console.log(`\nGrid parameters (scaled to ${height}p):`);
    console.log(`  Icon size: ${iconSize}px`);
    console.log(`  Spacing: ${spacing}px`);
    console.log(`  Bottom margin: ${bottomMargin}px`);
    console.log(`  Row height: ${rowHeight}px`);

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    console.log(`\nRow Y positions:`);
    for (let i = 0; i < rowYPositions.length; i++) {
        const y = rowYPositions[i];
        const valid = y >= height * 0.75;
        const pct = ((y / height) * 100).toFixed(1);
        console.log(`  Row ${i+1}: y=${y} (${pct}% from top) ${valid ? '✓' : '✗ SKIPPED'}`);
    }

    const sideMargin = Math.round(width * 0.20);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    console.log(`\nHorizontal layout:`);
    console.log(`  Side margin: ${sideMargin}px (${(sideMargin/width*100).toFixed(1)}%)`);
    console.log(`  Usable width: ${usableWidth}px`);
    console.log(`  Max items/row: ${maxItemsPerRow}`);

    // Calculate total grid positions
    let totalPositions = 0;
    const positions: Array<{x: number; y: number}> = [];

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.75) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);

        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * (iconSize + spacing), y: rowY });
            totalPositions++;
        }
    }

    console.log(`\nTotal grid cells scanned: ${totalPositions}`);

    // Check how many cells have content (variance > 300)
    let nonEmptyCells = 0;
    const cellDetails: Array<{pos: {x: number; y: number}; variance: number; mean: number; hasContent: boolean}> = [];

    for (const pos of positions) {
        const cellData = ctx.getImageData(pos.x, pos.y, iconSize, iconSize);

        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < cellData.data.length; i += 4) {
            const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
            sum += gray;
            sumSq += gray * gray;
            count++;
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        const hasContent = variance >= 300 && mean >= 40;

        if (hasContent) nonEmptyCells++;
        cellDetails.push({ pos, variance: Math.round(variance), mean: Math.round(mean), hasContent });
    }

    console.log(`Non-empty cells: ${nonEmptyCells} / ${totalPositions}`);

    // Show first row details
    console.log(`\nRow 1 cell details (first 10):`);
    for (const cell of cellDetails.slice(0, 10)) {
        const status = cell.hasContent ? '█' : '·';
        console.log(`  ${status} (${cell.pos.x}, ${cell.pos.y}): var=${cell.variance}, mean=${cell.mean}`);
    }

    // Save a debug image with grid overlay
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    for (const cell of cellDetails) {
        if (cell.hasContent) {
            ctx.strokeStyle = 'lime';
        } else {
            ctx.strokeStyle = 'red';
        }
        ctx.strokeRect(cell.pos.x, cell.pos.y, iconSize, iconSize);
    }

    const outPath = path.join(__dirname, '../test-images/gameplay/debug-grid-overlay.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outPath, buffer);
    console.log(`\nSaved debug image: ${outPath}`);
}

main().catch(console.error);
