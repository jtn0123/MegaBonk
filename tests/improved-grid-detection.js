#!/usr/bin/env node
// Improved grid detection - finds actual inventory position

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/grid-improved';

// Analyze a horizontal strip to find item-like content
function analyzeStrip(ctx, y, height, width) {
    const imageData = ctx.getImageData(0, y, width, height);
    const data = imageData.data;

    // Look for high-variance regions (items have texture, empty space doesn't)
    const segmentWidth = Math.floor(width / 40); // 40 segments
    const segments = [];

    for (let seg = 0; seg < 40; seg++) {
        const startX = seg * segmentWidth;
        let sum = 0, sumSq = 0, count = 0;

        for (let py = 0; py < height; py++) {
            for (let px = startX; px < startX + segmentWidth && px < width; px++) {
                const idx = (py * width + px) * 4;
                const gray = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                sum += gray;
                sumSq += gray * gray;
                count++;
            }
        }

        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        segments.push({ x: startX, variance, mean });
    }

    return segments;
}

// Find the inventory row by scanning from bottom up
function findInventoryRows(ctx, width, height) {
    const rows = [];

    // Scan bottom 40% of screen in strips
    const scanStart = Math.floor(height * 0.6);
    const stripHeight = 10;

    const variances = [];
    for (let y = scanStart; y < height - 20; y += stripHeight) {
        const segments = analyzeStrip(ctx, y, stripHeight, width);
        const avgVariance = segments.reduce((s, seg) => s + seg.variance, 0) / segments.length;
        const highVarCount = segments.filter(s => s.variance > 500).length;
        variances.push({ y, avgVariance, highVarCount });
    }

    // Find peaks in variance (rows with items)
    for (let i = 1; i < variances.length - 1; i++) {
        const curr = variances[i];
        const prev = variances[i-1];
        const next = variances[i+1];

        // Local maximum with significant variance
        if (curr.highVarCount > 5 && curr.highVarCount >= prev.highVarCount && curr.highVarCount >= next.highVarCount) {
            rows.push(curr.y);
        }
    }

    return rows;
}

// Improved grid detection
function detectGridImproved(ctx, width, height) {
    const scale = height / 720;

    // Key change: inventory is ABOVE the weapon bar
    // Weapon bar is at the very bottom (~50-60px scaled)
    // Inventory row(s) start above that

    const weaponBarHeight = Math.round(55 * scale); // Skip the weapon bar
    const iconSize = Math.round(36 * scale); // Slightly smaller icons
    const spacing = Math.round(4 * scale);
    const rowHeight = iconSize + spacing;

    const positions = [];

    // Try to find actual inventory rows
    const detectedRows = findInventoryRows(ctx, width, height);

    // If we found rows, use them; otherwise fall back to fixed positions
    let rowYPositions;
    if (detectedRows.length > 0) {
        // Use detected rows, adjusted for icon center
        rowYPositions = detectedRows.map(y => y - iconSize / 2).slice(0, 3);
    } else {
        // Fallback: fixed positions above weapon bar
        rowYPositions = [
            height - weaponBarHeight - iconSize,
            height - weaponBarHeight - iconSize - rowHeight,
            height - weaponBarHeight - iconSize - rowHeight * 2,
        ];
    }

    // For horizontal detection, scan for actual content
    const centerX = width / 2;
    const maxSearchWidth = Math.round(width * 0.7); // Items are centered in ~70% of width

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.5) continue; // Don't go above mid-screen

        // Find item columns in this row
        const rowData = ctx.getImageData(0, Math.max(0, rowY), width, iconSize);
        let itemColumns = [];

        // Scan for high-variance columns
        for (let x = Math.round(width * 0.15); x < width * 0.85; x += iconSize / 2) {
            let variance = 0;
            let count = 0;

            for (let py = 0; py < iconSize; py++) {
                for (let px = 0; px < iconSize && x + px < width; px++) {
                    const idx = (py * width + (x + px)) * 4;
                    const gray = (rowData.data[idx] + rowData.data[idx+1] + rowData.data[idx+2]) / 3;
                    variance += gray * gray;
                    count++;
                }
            }

            variance = variance / count;
            if (variance > 8000) { // Threshold for "has content"
                itemColumns.push(x);
            }
        }

        // Cluster nearby columns into item positions
        const clusters = [];
        let clusterStart = null;

        for (let i = 0; i < itemColumns.length; i++) {
            if (clusterStart === null) {
                clusterStart = itemColumns[i];
            } else if (itemColumns[i] - itemColumns[i-1] > iconSize) {
                // Gap found, end cluster
                clusters.push(Math.round((clusterStart + itemColumns[i-1]) / 2));
                clusterStart = itemColumns[i];
            }
        }
        if (clusterStart !== null && itemColumns.length > 0) {
            clusters.push(Math.round((clusterStart + itemColumns[itemColumns.length-1]) / 2));
        }

        // Add positions for this row
        for (const x of clusters) {
            positions.push({
                x: x - iconSize / 2,
                y: rowY,
                width: iconSize,
                height: iconSize
            });
        }
    }

    return { positions, iconSize, weaponBarHeight, scale };
}

// Also keep the fixed grid for comparison
function detectGridFixed(width, height) {
    const scale = height / 720;

    // FIXED: Larger bottom margin to skip weapon bar
    const bottomMargin = Math.round(55 * scale);
    const iconSize = Math.round(36 * scale);
    const spacing = Math.round(4 * scale);
    const rowHeight = iconSize + spacing;

    const positions = [];

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    // Narrower side margins - items are centered
    const sideMargin = Math.round(width * 0.25);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(18, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.55) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({
                x: startX + i * (iconSize + spacing),
                y: rowY,
                width: iconSize,
                height: iconSize
            });
        }
    }

    return { positions, iconSize, bottomMargin, scale };
}

function isEmptyCell(ctx, x, y, w, h) {
    const imageData = ctx.getImageData(Math.max(0, x), Math.max(0, y), w, h);
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    // Stricter threshold
    return variance < 400 || mean < 35;
}

async function testImage(imagePath, expectedItems) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // Test both methods
    const fixed = detectGridFixed(image.width, image.height);
    const improved = detectGridImproved(ctx, image.width, image.height);

    let fixedNonEmpty = 0;
    for (const cell of fixed.positions) {
        if (!isEmptyCell(ctx, cell.x, cell.y, cell.width, cell.height)) {
            fixedNonEmpty++;
        }
    }

    let improvedNonEmpty = 0;
    for (const cell of improved.positions) {
        if (!isEmptyCell(ctx, cell.x, cell.y, cell.width, cell.height)) {
            improvedNonEmpty++;
        }
    }

    return {
        width: image.width,
        height: image.height,
        expected: expectedItems,
        fixed: { total: fixed.positions.length, nonEmpty: fixedNonEmpty },
        improved: { total: improved.positions.length, nonEmpty: improvedNonEmpty }
    };
}

async function visualize(imagePath, outputPath, expectedItems) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height + 100);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const srcCanvas = createCanvas(image.width, image.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(image, 0, 0);

    const fixed = detectGridFixed(image.width, image.height);

    let nonEmpty = 0;
    for (const cell of fixed.positions) {
        const empty = isEmptyCell(srcCtx, cell.x, cell.y, cell.width, cell.height);
        if (!empty) nonEmpty++;

        ctx.strokeStyle = empty ? 'rgba(100, 100, 255, 0.3)' : 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = empty ? 1 : 2;
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
    }

    // Info panel
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, image.height, image.width, 100);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`Fixed grid: ${nonEmpty} non-empty / ${fixed.positions.length} cells | Expected: ${expectedItems}`, 10, image.height + 20);
    ctx.fillText(`Parameters: iconSize=${fixed.iconSize}, bottomMargin=${fixed.bottomMargin}, scale=${fixed.scale.toFixed(2)}`, 10, image.height + 40);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
}

async function main() {
    console.log('=== Improved Grid Detection Test ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Expected | Old | New Fixed | Improved |');
    console.log('|-------|----------|-----|-----------|----------|');

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        const result = await testImage(imagePath, data.items.length);

        // Generate visualization with fixed params
        const outputPath = path.join(OUTPUT_DIR, `grid_${name.replace(/[\/\.]/g, '_')}.png`);
        await visualize(imagePath, outputPath, data.items.length);

        const shortName = name.slice(9, 30);
        console.log(`| ${shortName.padEnd(20)} | ${String(result.expected).padStart(8)} | ${String(result.fixed.nonEmpty).padStart(3)} | ${String(result.fixed.nonEmpty).padStart(9)} | ${String(result.improved.nonEmpty).padStart(8)} |`);
    }

    console.log(`\nVisualization saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
