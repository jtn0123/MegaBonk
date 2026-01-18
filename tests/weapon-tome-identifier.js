#!/usr/bin/env node
// Identify equipped weapons and tomes from the top-left UI grid

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/weapon-tome-id';

// Weapon/Tome grid parameters (calibrated from previous work)
const GRID_PARAMS = {
    leftMarginBase: 6,
    topMarginBase: 135,
    iconSizeBase: 32,
    spacingXBase: 10,
    spacingYBase: 45,
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

    return { positions, iconSize, scale };
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
    return variance < 500 || mean < 40;
}

function calculateNCC(d1, d2) {
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    const len = Math.min(d1.data.length, d2.data.length);
    for (let i = 0; i < len; i += 4) {
        const g1 = (d1.data[i] + d1.data[i+1] + d1.data[i+2]) / 3;
        const g2 = (d2.data[i] + d2.data[i+1] + d2.data[i+2]) / 3;
        s1 += g1; s2 += g2; sp += g1*g2; ss1 += g1*g1; ss2 += g2*g2; c++;
    }
    const m1 = s1/c, m2 = s2/c;
    const num = sp/c - m1*m2;
    const den = Math.sqrt((ss1/c - m1*m1) * (ss2/c - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

async function loadTemplates() {
    const weapons = new Map();
    const tomes = new Map();

    // Load weapons
    const weaponsData = JSON.parse(fs.readFileSync('./data/weapons.json', 'utf-8'));
    for (const weapon of weaponsData.weapons) {
        if (!weapon.image) continue;
        const imagePath = path.join('./src/', weapon.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            weapons.set(weapon.id, {
                name: weapon.name,
                imageData: ctx.getImageData(0, 0, 32, 32)
            });
        } catch {}
    }

    // Load tomes
    const tomesData = JSON.parse(fs.readFileSync('./data/tomes.json', 'utf-8'));
    for (const tome of tomesData.tomes) {
        if (!tome.image) continue;
        const imagePath = path.join('./src/', tome.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            tomes.set(tome.id, {
                name: tome.name,
                imageData: ctx.getImageData(0, 0, 32, 32)
            });
        } catch {}
    }

    return { weapons, tomes };
}

function matchSlot(ctx, pos, templates) {
    // Extract slot image
    const slotCanvas = createCanvas(32, 32);
    const slotCtx = slotCanvas.getContext('2d');

    // Get slot data
    const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
    const srcCanvas = createCanvas(pos.width, pos.height);
    srcCanvas.getContext('2d').putImageData(cellData, 0, 0);

    // Resize to 32x32
    slotCtx.drawImage(srcCanvas, 0, 0, 32, 32);
    const slotData = slotCtx.getImageData(0, 0, 32, 32);

    let bestMatch = null;
    let bestScore = 0;

    for (const [id, template] of templates) {
        const score = calculateNCC(slotData, template.imageData);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = { id, name: template.name };
        }
    }

    return { match: bestMatch, confidence: bestScore, slotCanvas };
}

async function main() {
    console.log('=== Weapon/Tome Identification ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const { weapons, tomes } = await loadTemplates();
    console.log(`Loaded ${weapons.size} weapon templates, ${tomes.size} tome templates\n`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    const allResults = [];

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const { positions, iconSize, scale } = detectWeaponTomeGrid(image.width, image.height);

        console.log(`\n--- ${filename.slice(9, 40)} ---`);

        const detectedWeapons = [];
        const detectedTomes = [];

        for (const pos of positions) {
            if (isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height)) {
                continue;
            }

            const templateSet = pos.type === 'weapon' ? weapons : tomes;
            const result = matchSlot(ctx, pos, templateSet);

            if (result.match) {
                const item = {
                    slot: pos.col + 1,
                    id: result.match.id,
                    name: result.match.name,
                    confidence: result.confidence
                };

                if (pos.type === 'weapon') {
                    detectedWeapons.push(item);
                    console.log(`  Weapon ${pos.col + 1}: ${item.name} (${(item.confidence * 100).toFixed(0)}%)`);
                } else {
                    detectedTomes.push(item);
                    console.log(`  Tome ${pos.col + 1}: ${item.name} (${(item.confidence * 100).toFixed(0)}%)`);
                }
            }
        }

        // Compare with ground truth if available
        const expectedWeapons = data.equipped_weapons || [];
        console.log(`  Expected: ${expectedWeapons.slice(0, 4).join(', ')}`);

        allResults.push({
            filename,
            weapons: detectedWeapons,
            tomes: detectedTomes,
            expected: expectedWeapons
        });

        // Create visualization
        const vizCanvas = createCanvas(image.width, image.height + 120);
        const vizCtx = vizCanvas.getContext('2d');
        vizCtx.drawImage(image, 0, 0);

        // Draw detected slots
        for (const pos of positions) {
            const isEmpty = isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height);
            if (isEmpty) {
                vizCtx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
                vizCtx.lineWidth = 1;
            } else {
                vizCtx.strokeStyle = pos.type === 'weapon' ? 'rgba(255, 100, 0, 0.9)' : 'rgba(100, 200, 255, 0.9)';
                vizCtx.lineWidth = 2;
            }
            vizCtx.strokeRect(pos.x, pos.y, pos.width, pos.height);
        }

        // Info panel
        vizCtx.fillStyle = '#1a1a2e';
        vizCtx.fillRect(0, image.height, image.width, 120);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '11px monospace';

        vizCtx.fillText(`Weapons: ${detectedWeapons.map(w => w.name).join(', ') || 'none'}`, 10, image.height + 20);
        vizCtx.fillText(`Tomes: ${detectedTomes.map(t => t.name).join(', ') || 'none'}`, 10, image.height + 40);
        vizCtx.fillText(`Expected (first 4): ${expectedWeapons.slice(0, 4).join(', ') || 'N/A'}`, 10, image.height + 60);

        // Draw mini slots
        let slotX = 10;
        for (const pos of positions) {
            if (!isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height)) {
                const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
                const miniCanvas = createCanvas(pos.width, pos.height);
                miniCanvas.getContext('2d').putImageData(cellData, 0, 0);
                vizCtx.drawImage(miniCanvas, slotX, image.height + 75, 35, 35);
                slotX += 40;
            }
        }

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `wt_${filename.replace(/[\/\.]/g, '_')}.png`),
            vizCanvas.toBuffer('image/png')
        );
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));

    const avgWeaponConf = allResults.flatMap(r => r.weapons.map(w => w.confidence));
    const avgTomeConf = allResults.flatMap(r => r.tomes.map(t => t.confidence));

    if (avgWeaponConf.length > 0) {
        const avg = avgWeaponConf.reduce((a, b) => a + b, 0) / avgWeaponConf.length;
        console.log(`\nAvg weapon match confidence: ${(avg * 100).toFixed(1)}%`);
    }
    if (avgTomeConf.length > 0) {
        const avg = avgTomeConf.reduce((a, b) => a + b, 0) / avgTomeConf.length;
        console.log(`Avg tome match confidence: ${(avg * 100).toFixed(1)}%`);
    }

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'results.json'),
        JSON.stringify(allResults, null, 2)
    );

    console.log(`\nResults saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
