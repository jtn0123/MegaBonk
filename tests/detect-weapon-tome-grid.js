#!/usr/bin/env node
// Detect weapon and tome slots in the top-left UI grid

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/weapon-tome-grid';

// Weapon/Tome grid parameters (at 720p reference)
// Based on zoomed screenshot measurements:
// - Weapons start at Y≈135px at 720p scale (below health/XP bars)
// - Icons are ~32px square
// - Horizontal spacing ~10px between icons
// - Vertical spacing ~45px (includes "LVL X" label below each icon)
const GRID_PARAMS = {
    // Position from top-left (weapons start below health bars)
    leftMarginBase: 6,
    topMarginBase: 135,  // Below health/status bars ~135px at 720p

    // Icon size
    iconSizeBase: 32,

    // Spacing between icons
    spacingXBase: 10,
    spacingYBase: 45,  // Includes LVL label between rows

    // Grid layout: 4 columns, 2 rows (weapons on top, tomes below)
    cols: 4,
    rows: 2
};

function detectWeaponTomeGrid(width, height) {
    const scale = height / 720;

    const leftMargin = Math.round(GRID_PARAMS.leftMarginBase * scale);
    const topMargin = Math.round(GRID_PARAMS.topMarginBase * scale);
    const iconSize = Math.round(GRID_PARAMS.iconSizeBase * scale);
    const spacingX = Math.round(GRID_PARAMS.spacingXBase * scale);
    const spacingY = Math.round(GRID_PARAMS.spacingYBase * scale);

    const positions = [];

    for (let row = 0; row < GRID_PARAMS.rows; row++) {
        for (let col = 0; col < GRID_PARAMS.cols; col++) {
            positions.push({
                x: leftMargin + col * (iconSize + spacingX),
                y: topMargin + row * (iconSize + spacingY),
                width: iconSize,
                height: iconSize,
                row,
                col,
                type: row === 0 ? 'weapon' : 'tome'
            });
        }
    }

    return { positions, params: { leftMargin, topMargin, iconSize, scale } };
}

function isEmptySlot(ctx, x, y, w, h) {
    const imageData = ctx.getImageData(Math.round(x), Math.round(y), w, h);
    let sum = 0, sumSq = 0, count = 0;

    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Empty slots are typically dark with low variance
    return variance < 500 || mean < 40;
}

async function analyzeImage(imagePath, data) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const { positions, params } = detectWeaponTomeGrid(image.width, image.height);

    const results = {
        weapons: [],
        tomes: [],
        positions,
        params
    };

    for (const pos of positions) {
        const empty = isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height);
        if (!empty) {
            if (pos.type === 'weapon') {
                results.weapons.push(pos);
            } else {
                results.tomes.push(pos);
            }
        }
    }

    // Create visualization
    const outCanvas = createCanvas(image.width, image.height + 60);
    const outCtx = outCanvas.getContext('2d');
    outCtx.drawImage(image, 0, 0);

    // Draw grid area boundary
    const gridWidth = GRID_PARAMS.cols * (params.iconSize + Math.round(GRID_PARAMS.spacingXBase * params.scale));
    const gridHeight = GRID_PARAMS.rows * (params.iconSize + Math.round(GRID_PARAMS.spacingYBase * params.scale));
    outCtx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
    outCtx.lineWidth = 2;
    outCtx.strokeRect(params.leftMargin - 2, params.topMargin - 2, gridWidth + 4, gridHeight + 4);

    // Draw individual slots
    for (const pos of positions) {
        const empty = isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height);
        outCtx.strokeStyle = empty ? 'rgba(100, 100, 255, 0.4)' : (pos.type === 'weapon' ? 'rgba(255, 100, 0, 0.9)' : 'rgba(0, 255, 100, 0.9)');
        outCtx.lineWidth = empty ? 1 : 2;
        outCtx.strokeRect(pos.x, pos.y, pos.width, pos.height);
    }

    // Info panel
    outCtx.fillStyle = '#1a1a2e';
    outCtx.fillRect(0, image.height, image.width, 60);
    outCtx.fillStyle = '#fff';
    outCtx.font = '11px monospace';

    const expectedWeapons = (data.equipped_weapons || []).length;
    outCtx.fillText(`Weapons: ${results.weapons.length} detected (expected: ${expectedWeapons})`, 10, image.height + 20);
    outCtx.fillText(`Tomes: ${results.tomes.length} detected | Grid at: (${params.leftMargin}, ${params.topMargin}), iconSize=${params.iconSize}`, 10, image.height + 40);

    return { canvas: outCanvas, results, expectedWeapons };
}

async function main() {
    console.log('=== Weapon/Tome Grid Detection ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Resolution | Weapons | Expected | Tomes |');
    console.log('|-------|------------|---------|----------|-------|');

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        const { canvas, results, expectedWeapons } = await analyzeImage(imagePath, data);

        // Save visualization
        fs.writeFileSync(
            path.join(OUTPUT_DIR, `wt_${name.replace(/[\/\.]/g, '_')}.png`),
            canvas.toBuffer('image/png')
        );

        const shortName = name.slice(9, 35);
        console.log(`| ${shortName.padEnd(25)} | ${results.params.scale.toFixed(2)} | ${String(results.weapons.length).padStart(7)} | ${String(expectedWeapons).padStart(8)} | ${String(results.tomes.length).padStart(5)} |`);
    }

    console.log(`\nVisualization: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
