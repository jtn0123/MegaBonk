#!/usr/bin/env node
// Unified grid detection: combines weapon/tome grid (top-left) and inventory grid (bottom)

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/unified-grid';

// ============== WEAPON/TOME GRID (top-left, 4 columns x 2 rows) ==============
const WEAPON_TOME_PARAMS = {
    leftMarginBase: 6,
    topMarginBase: 135,
    iconSizeBase: 32,
    spacingXBase: 10,
    spacingYBase: 45,
    cols: 4,
    rows: 2
};

// ============== INVENTORY GRID (bottom area, multiple rows) ==============
const INVENTORY_PARAMS = {
    iconSizeBase: 34,
    spacingBase: 4,
    bottomMarginBase: 42,
    rowHeightBase: 40,
    maxRows: 3,
    minYPercent: 0.70,
    sideMarginPercent: 0.15
};

function detectWeaponTomeGrid(width, height) {
    const scale = height / 720;
    const p = WEAPON_TOME_PARAMS;

    const leftMargin = Math.round(p.leftMarginBase * scale);
    const topMargin = Math.round(p.topMarginBase * scale);
    const iconSize = Math.round(p.iconSizeBase * scale);
    const spacingX = Math.round(p.spacingXBase * scale);
    const spacingY = Math.round(p.spacingYBase * scale);

    const positions = [];

    for (let row = 0; row < p.rows; row++) {
        for (let col = 0; col < p.cols; col++) {
            positions.push({
                x: leftMargin + col * (iconSize + spacingX),
                y: topMargin + row * (iconSize + spacingY),
                width: iconSize,
                height: iconSize,
                type: row === 0 ? 'weapon' : 'tome',
                row,
                col
            });
        }
    }

    return { positions, iconSize, scale };
}

function detectInventoryGrid(width, height) {
    const scale = height / 720;
    const p = INVENTORY_PARAMS;

    const iconSize = Math.round(p.iconSizeBase * scale);
    const spacing = Math.round(p.spacingBase * scale);
    const bottomMargin = Math.round(p.bottomMarginBase * scale);
    const rowHeight = Math.round(p.rowHeightBase * scale);

    const positions = [];

    // Calculate row Y positions (from bottom up)
    const rowYPositions = [];
    for (let row = 0; row < p.maxRows; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * p.minYPercent) {
            rowYPositions.push(y);
        }
    }

    // Calculate horizontal positions (centered)
    const sideMargin = Math.round(width * p.sideMarginPercent);
    const usableWidth = width - sideMargin * 2;
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / cellWidth));

    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({
                x: startX + i * cellWidth,
                y: rowY,
                width: iconSize,
                height: iconSize,
                type: 'item',
                row: rowYPositions.indexOf(rowY),
                col: i
            });
        }
    }

    return { positions, iconSize, scale, rowYPositions };
}

function isEmptyCell(ctx, x, y, w, h, threshold = 400) {
    if (x < 0 || y < 0) return true;

    const imageData = ctx.getImageData(Math.round(x), Math.round(y), w, h);
    let sum = 0, sumSq = 0, count = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    return variance < threshold || mean < 35;
}

async function analyzeImage(imagePath, groundTruth) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const scale = image.height / 720;

    // Detect both grids
    const weaponTome = detectWeaponTomeGrid(image.width, image.height);
    const inventory = detectInventoryGrid(image.width, image.height);

    // Count non-empty cells
    const results = {
        weapons: { detected: 0, positions: [] },
        tomes: { detected: 0, positions: [] },
        items: { detected: 0, positions: [] }
    };

    // Analyze weapon/tome grid (use slightly lower threshold for equipped items)
    for (const pos of weaponTome.positions) {
        if (!isEmptyCell(ctx, pos.x, pos.y, pos.width, pos.height, 500)) {
            if (pos.type === 'weapon') {
                results.weapons.detected++;
                results.weapons.positions.push(pos);
            } else {
                results.tomes.detected++;
                results.tomes.positions.push(pos);
            }
        }
    }

    // Analyze inventory grid
    for (const pos of inventory.positions) {
        if (!isEmptyCell(ctx, pos.x, pos.y, pos.width, pos.height, 350)) {
            results.items.detected++;
            results.items.positions.push(pos);
        }
    }

    // Expected values from ground truth
    const expectedItems = groundTruth.items?.length || 0;
    const expectedWeapons = Math.min(4, (groundTruth.equipped_weapons || []).length);

    return {
        width: image.width,
        height: image.height,
        scale,
        results,
        expected: { items: expectedItems, weapons: expectedWeapons },
        grids: { weaponTome, inventory }
    };
}

async function visualize(imagePath, groundTruth) {
    const image = await loadImage(imagePath);
    const analysis = await analyzeImage(imagePath, groundTruth);

    // Create visualization canvas with info panel
    const canvas = createCanvas(image.width, image.height + 100);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const srcCtx = (createCanvas(image.width, image.height).getContext('2d'));
    srcCtx.drawImage(image, 0, 0);

    // Draw weapon/tome grid
    for (const pos of analysis.grids.weaponTome.positions) {
        const empty = isEmptyCell(srcCtx, pos.x, pos.y, pos.width, pos.height, 500);
        if (pos.type === 'weapon') {
            ctx.strokeStyle = empty ? 'rgba(255, 100, 0, 0.3)' : 'rgba(255, 100, 0, 0.9)';
        } else {
            ctx.strokeStyle = empty ? 'rgba(200, 0, 200, 0.3)' : 'rgba(200, 0, 200, 0.9)';
        }
        ctx.lineWidth = empty ? 1 : 2;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
    }

    // Draw inventory grid
    for (const pos of analysis.grids.inventory.positions) {
        const empty = isEmptyCell(srcCtx, pos.x, pos.y, pos.width, pos.height, 350);
        ctx.strokeStyle = empty ? 'rgba(0, 100, 255, 0.3)' : 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = empty ? 1 : 2;
        ctx.strokeRect(pos.x, pos.y, pos.width, pos.height);
    }

    // Info panel
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, image.height, image.width, 100);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';

    const r = analysis.results;
    const e = analysis.expected;
    const itemDiff = r.items.detected - e.items;

    const lines = [
        `Resolution: ${analysis.width}x${analysis.height} | Scale: ${analysis.scale.toFixed(2)}`,
        `Weapons: ${r.weapons.detected}/4 | Tomes: ${r.tomes.detected}/4 (equipped slots)`,
        `Items: ${r.items.detected} detected | Expected: ${e.items} | Diff: ${itemDiff >= 0 ? '+' : ''}${itemDiff}`,
        `Legend: Orange=weapon, Purple=tome, Green=item, Blue=empty slot`
    ];

    lines.forEach((line, i) => ctx.fillText(line, 10, image.height + 18 + i * 20));

    return { canvas, analysis };
}

async function main() {
    console.log('=== Unified Grid Detection ===\n');
    console.log('Weapon/Tome Grid:', WEAPON_TOME_PARAMS);
    console.log('Inventory Grid:', INVENTORY_PARAMS);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('\n| Image | Scale | Weapons | Tomes | Items | Expected | Diff |');
    console.log('|-------|-------|---------|-------|-------|----------|------|');

    let totalItems = 0, totalExpected = 0;
    let totalWeapons = 0, totalTomes = 0;

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        const { canvas, analysis } = await visualize(imagePath, data);

        // Save visualization
        const outputPath = path.join(OUTPUT_DIR, `unified_${name.replace(/[\/\.]/g, '_')}.png`);
        fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));

        const r = analysis.results;
        const e = analysis.expected;
        const diff = r.items.detected - e.items;

        const shortName = name.slice(9, 35);
        console.log(`| ${shortName.padEnd(25)} | ${analysis.scale.toFixed(2)} | ${String(r.weapons.detected).padStart(7)} | ${String(r.tomes.detected).padStart(5)} | ${String(r.items.detected).padStart(5)} | ${String(e.items).padStart(8)} | ${(diff >= 0 ? '+' : '') + String(diff).padStart(4)} |`);

        totalItems += r.items.detected;
        totalExpected += e.items;
        totalWeapons += r.weapons.detected;
        totalTomes += r.tomes.detected;
    }

    console.log('|-------|-------|---------|-------|-------|----------|------|');
    const totalDiff = totalItems - totalExpected;
    console.log(`| TOTAL |       | ${String(totalWeapons).padStart(7)} | ${String(totalTomes).padStart(5)} | ${String(totalItems).padStart(5)} | ${String(totalExpected).padStart(8)} | ${(totalDiff >= 0 ? '+' : '') + String(totalDiff).padStart(4)} |`);

    console.log(`\nVisualization: ${OUTPUT_DIR}/`);

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Weapon detection: ${totalWeapons}/${testCases.length * 4} slots (${(totalWeapons / (testCases.length * 4) * 100).toFixed(1)}%)`);
    console.log(`Tome detection: ${totalTomes}/${testCases.length * 4} slots (${(totalTomes / (testCases.length * 4) * 100).toFixed(1)}%)`);
    console.log(`Item detection accuracy: ${totalItems} vs ${totalExpected} expected (${totalDiff >= 0 ? '+' : ''}${totalDiff})`);
}

main().catch(console.error);
