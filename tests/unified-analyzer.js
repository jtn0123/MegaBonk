#!/usr/bin/env node
// Unified game state analyzer - combines all CV detectors

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/unified-analysis';

// ==================== BIOME DETECTION ====================
const BIOME_SIGNATURES = {
    forest: { dominant: { r: [60, 100], g: [50, 90], b: [100, 150] } },
    desert: { dominant: { r: [85, 125], g: [95, 135], b: [115, 155] } },
    snow: { dominant: { r: [100, 140], g: [110, 150], b: [125, 165] } },
    hell: { dominant: { r: [100, 140], g: [35, 85], b: [25, 75] } },
    ocean: { dominant: { r: [10, 60], g: [100, 150], b: [130, 180] } },
    crypt: { dominant: { r: [85, 125], g: [70, 105], b: [90, 130] } }
};

function detectBiome(ctx, width, height) {
    const regions = [
        { x: width * 0.3, y: height * 0.25, w: width * 0.4, h: height * 0.3 },
        { x: width * 0.2, y: height * 0.4, w: width * 0.2, h: height * 0.2 },
    ];

    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    for (const region of regions) {
        const data = ctx.getImageData(Math.round(region.x), Math.round(region.y),
                                       Math.round(region.w), Math.round(region.h));
        for (let i = 0; i < data.data.length; i += 4) {
            sumR += data.data[i]; sumG += data.data[i+1]; sumB += data.data[i+2];
            count++;
        }
    }

    const avg = { r: sumR / count, g: sumG / count, b: sumB / count };

    let bestBiome = null, bestScore = -1;
    for (const [biome, sig] of Object.entries(BIOME_SIGNATURES)) {
        let score = 0;
        const d = sig.dominant;
        if (avg.r >= d.r[0] && avg.r <= d.r[1]) score += 2;
        if (avg.g >= d.g[0] && avg.g <= d.g[1]) score += 2;
        if (avg.b >= d.b[0] && avg.b <= d.b[1]) score += 2;

        score += Math.max(0, 3 - Math.abs(avg.r - (d.r[0] + d.r[1])/2) / 30);
        score += Math.max(0, 3 - Math.abs(avg.g - (d.g[0] + d.g[1])/2) / 30);
        score += Math.max(0, 3 - Math.abs(avg.b - (d.b[0] + d.b[1])/2) / 30);

        if (score > bestScore) { bestScore = score; bestBiome = biome; }
    }

    return { biome: bestBiome, confidence: bestScore / 15, avgColor: avg };
}

// ==================== WEAPON/TOME GRID ====================
const WEAPON_TOME_GRID = {
    leftMarginBase: 6, topMarginBase: 135, iconSizeBase: 32,
    spacingXBase: 10, spacingYBase: 45, cols: 4, rows: 2
};

function detectWeaponTomeSlots(ctx, width, height) {
    const scale = height / 720;
    const p = WEAPON_TOME_GRID;
    const positions = [];

    for (let row = 0; row < p.rows; row++) {
        for (let col = 0; col < p.cols; col++) {
            const iconSize = Math.round(p.iconSizeBase * scale);
            positions.push({
                x: Math.round(p.leftMarginBase * scale) + col * (iconSize + Math.round(p.spacingXBase * scale)),
                y: Math.round(p.topMarginBase * scale) + row * (iconSize + Math.round(p.spacingYBase * scale)),
                width: iconSize, height: iconSize,
                type: row === 0 ? 'weapon' : 'tome', slot: col + 1
            });
        }
    }

    const slots = [];
    for (const pos of positions) {
        const data = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < data.data.length; i += 4) {
            const gray = (data.data[i] + data.data[i+1] + data.data[i+2]) / 3;
            sum += gray; sumSq += gray * gray; count++;
        }
        const variance = sumSq / count - (sum / count) ** 2;
        const isEmpty = variance < 500 || sum / count < 40;

        if (!isEmpty) {
            slots.push({ ...pos, variance, occupied: true });
        }
    }

    return { slots, weaponCount: slots.filter(s => s.type === 'weapon').length,
             tomeCount: slots.filter(s => s.type === 'tome').length };
}

// ==================== INVENTORY GRID ====================
const INVENTORY_GRID = {
    iconSizeBase: 34, spacingBase: 4, bottomMarginBase: 42,
    rowHeightBase: 40, maxRows: 3, minYPercent: 0.70, sideMarginPercent: 0.15
};

function detectInventoryItems(ctx, width, height) {
    const scale = height / 720;
    const p = INVENTORY_GRID;
    const iconSize = Math.round(p.iconSizeBase * scale);
    const spacing = Math.round(p.spacingBase * scale);
    const bottomMargin = Math.round(p.bottomMarginBase * scale);
    const rowHeight = Math.round(p.rowHeightBase * scale);

    const positions = [];
    const rowYPositions = [];
    for (let row = 0; row < p.maxRows; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * p.minYPercent) rowYPositions.push(y);
    }

    const sideMargin = Math.round(width * p.sideMarginPercent);
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor((width - sideMargin * 2) / cellWidth));
    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize });
        }
    }

    let itemCount = 0;
    for (const pos of positions) {
        const data = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < data.data.length; i += 4) {
            const gray = (data.data[i] + data.data[i+1] + data.data[i+2]) / 3;
            sum += gray; sumSq += gray * gray; count++;
        }
        const variance = sumSq / count - (sum / count) ** 2;
        if (variance >= 350 && sum / count >= 30) itemCount++;
    }

    return { itemCount, gridPositions: positions.length };
}

// ==================== CHARACTER REGION ====================
function detectCharacterRegion(ctx, width, height) {
    const x = Math.round(width * 0.45);
    const y = Math.round(height * 0.40);
    const w = Math.round(width * 0.10);
    const h = Math.round(height * 0.15);

    const data = ctx.getImageData(x, y, w, h);
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let i = 0; i < data.data.length; i += 4) {
        const brightness = (data.data[i] + data.data[i+1] + data.data[i+2]) / 3;
        if (brightness > 30 && brightness < 240) {
            sumR += data.data[i]; sumG += data.data[i+1]; sumB += data.data[i+2];
            count++;
        }
    }

    return {
        region: { x, y, w, h },
        avgColor: count > 0 ? { r: sumR/count, g: sumG/count, b: sumB/count } : null,
        detected: count > 100
    };
}

// ==================== CROSS-VALIDATION ====================
function crossValidate(biome, weapons, tomes, items) {
    const validations = [];
    let confidenceBoost = 0;

    // Hell biome typically has more items due to longer runs
    if (biome.biome === 'hell' && items.itemCount > 25) {
        validations.push('Hell biome with high item count - consistent');
        confidenceBoost += 0.1;
    }

    // Early game (forest) usually has fewer items
    if (biome.biome === 'forest' && items.itemCount < 15) {
        validations.push('Forest biome with low item count - consistent');
        confidenceBoost += 0.1;
    }

    // Should have 4 weapon slots max
    if (weapons.weaponCount <= 4) {
        validations.push('Weapon count within expected range');
        confidenceBoost += 0.05;
    }

    // Should have 4 tome slots max
    if (tomes.tomeCount <= 4) {
        validations.push('Tome count within expected range');
        confidenceBoost += 0.05;
    }

    return { validations, confidenceBoost };
}

// ==================== MAIN ANALYZER ====================
async function analyzeScreenshot(imagePath) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const width = image.width;
    const height = image.height;
    const scale = height / 720;

    // Run all detectors
    const biome = detectBiome(ctx, width, height);
    const weaponTome = detectWeaponTomeSlots(ctx, width, height);
    const inventory = detectInventoryItems(ctx, width, height);
    const character = detectCharacterRegion(ctx, width, height);

    // Cross-validate
    const validation = crossValidate(biome, weaponTome, weaponTome, inventory);

    // Adjust biome confidence based on cross-validation
    biome.confidence = Math.min(1, biome.confidence + validation.confidenceBoost);

    return {
        resolution: { width, height, scale },
        biome,
        equipped: {
            weapons: weaponTome.slots.filter(s => s.type === 'weapon').length,
            tomes: weaponTome.slots.filter(s => s.type === 'tome').length
        },
        inventory: {
            itemCount: inventory.itemCount,
            gridSlots: inventory.gridPositions
        },
        character: {
            detected: character.detected,
            avgColor: character.avgColor
        },
        validation,
        ctx,
        image
    };
}

async function main() {
    console.log('=== Unified Game State Analyzer ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Biome | Wpns | Tomes | Items | Validations |');
    console.log('|-------|-------|------|-------|-------|-------------|');

    const results = [];

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const analysis = await analyzeScreenshot(imagePath);

        const shortName = filename.slice(9, 30);
        const validCount = analysis.validation.validations.length;

        console.log(`| ${shortName.padEnd(20)} | ${analysis.biome.biome.padEnd(6)} | ${String(analysis.equipped.weapons).padStart(4)} | ${String(analysis.equipped.tomes).padStart(5)} | ${String(analysis.inventory.itemCount).padStart(5)} | ${String(validCount).padStart(11)} |`);

        results.push({
            filename,
            ...analysis,
            ctx: undefined,
            image: undefined
        });

        // Create visualization
        const vizCanvas = createCanvas(analysis.image.width, analysis.image.height + 150);
        const vizCtx = vizCanvas.getContext('2d');
        vizCtx.drawImage(analysis.image, 0, 0);

        // Draw weapon/tome grid
        const wtSlots = detectWeaponTomeSlots(analysis.ctx, analysis.image.width, analysis.image.height);
        for (const slot of wtSlots.slots) {
            vizCtx.strokeStyle = slot.type === 'weapon' ? 'rgba(255, 100, 0, 0.9)' : 'rgba(100, 200, 255, 0.9)';
            vizCtx.lineWidth = 2;
            vizCtx.strokeRect(slot.x, slot.y, slot.width, slot.height);
        }

        // Draw character region
        if (analysis.character.detected) {
            vizCtx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            vizCtx.lineWidth = 2;
            const r = analysis.character;
            vizCtx.strokeRect(
                Math.round(analysis.image.width * 0.45),
                Math.round(analysis.image.height * 0.40),
                Math.round(analysis.image.width * 0.10),
                Math.round(analysis.image.height * 0.15)
            );
        }

        // Info panel
        vizCtx.fillStyle = '#1a1a2e';
        vizCtx.fillRect(0, analysis.image.height, analysis.image.width, 150);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '12px monospace';

        const lines = [
            `BIOME: ${analysis.biome.biome} (${(analysis.biome.confidence * 100).toFixed(0)}%)`,
            `EQUIPPED: ${analysis.equipped.weapons} weapons, ${analysis.equipped.tomes} tomes`,
            `INVENTORY: ${analysis.inventory.itemCount} items`,
            `CHARACTER: ${analysis.character.detected ? 'Detected' : 'Not detected'}`,
            `VALIDATIONS: ${analysis.validation.validations.join('; ') || 'None'}`,
            `Resolution: ${analysis.resolution.width}x${analysis.resolution.height} (scale ${analysis.resolution.scale.toFixed(2)})`
        ];

        lines.forEach((line, i) => vizCtx.fillText(line, 10, analysis.image.height + 20 + i * 22));

        // Biome color swatch
        if (analysis.biome.avgColor) {
            const c = analysis.biome.avgColor;
            vizCtx.fillStyle = `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
            vizCtx.fillRect(analysis.image.width - 60, analysis.image.height + 10, 50, 50);
            vizCtx.strokeStyle = '#fff';
            vizCtx.strokeRect(analysis.image.width - 60, analysis.image.height + 10, 50, 50);
        }

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `unified_${filename.replace(/[\/\.]/g, '_')}.png`),
            vizCanvas.toBuffer('image/png')
        );
    }

    console.log('|-------|-------|------|-------|-------|-------------|');

    // Summary stats
    const avgItems = results.reduce((s, r) => s + r.inventory.itemCount, 0) / results.length;
    const avgWeapons = results.reduce((s, r) => s + r.equipped.weapons, 0) / results.length;

    console.log(`\nAverage items: ${avgItems.toFixed(1)}`);
    console.log(`Average equipped weapons: ${avgWeapons.toFixed(1)}`);

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'analysis-results.json'),
        JSON.stringify(results, null, 2)
    );

    console.log(`\nResults saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
