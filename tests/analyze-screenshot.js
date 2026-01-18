#!/usr/bin/env node
// End-to-end screenshot analyzer CLI
// Usage: node analyze-screenshot.js <image-path> [--json] [--verbose]

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

// ==================== CONFIGURATION ====================
const BIOME_SIGNATURES = {
    forest: { dominant: { r: [60, 100], g: [50, 90], b: [100, 150] }, name: 'Forest' },
    desert: { dominant: { r: [85, 125], g: [95, 135], b: [115, 155] }, name: 'Desert' },
    snow: { dominant: { r: [100, 140], g: [110, 150], b: [125, 165] }, name: 'Snow' },
    hell: { dominant: { r: [100, 140], g: [35, 85], b: [25, 75] }, name: 'Hell' },
    ocean: { dominant: { r: [10, 60], g: [100, 150], b: [130, 180] }, name: 'Ocean' },
    crypt: { dominant: { r: [85, 125], g: [70, 105], b: [90, 130] }, name: 'Crypt' }
};

const WEAPON_TOME_GRID = {
    leftMarginBase: 6, topMarginBase: 135, iconSizeBase: 32,
    spacingXBase: 10, spacingYBase: 45, cols: 4, rows: 2
};

// ==================== DETECTION FUNCTIONS ====================

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

    let bestBiome = 'unknown', bestScore = -1;
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

    return {
        biome: bestBiome,
        biomeName: BIOME_SIGNATURES[bestBiome]?.name || 'Unknown',
        confidence: Math.min(1, bestScore / 15),
        avgColor: avg
    };
}

function detectInventoryGrid(ctx, width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);

    const items = [];
    const rows = [];

    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y < height * 0.65) continue;

        const sideMargin = Math.round(width * 0.15);
        const cellWidth = iconSize + spacing;
        const maxItemsPerRow = Math.min(22, Math.floor((width - sideMargin * 2) / cellWidth));
        const totalWidth = maxItemsPerRow * cellWidth;
        const startX = Math.round((width - totalWidth) / 2);

        let rowItems = 0;
        for (let col = 0; col < maxItemsPerRow; col++) {
            const x = startX + col * cellWidth;
            const cellData = ctx.getImageData(x, y, iconSize, iconSize);

            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const mean = sum / count;
            const variance = sumSq / count - mean * mean;

            if (variance >= 350 && mean >= 30) {
                items.push({ row, col, x, y, width: iconSize, height: iconSize, variance, mean });
                rowItems++;
            }
        }
        if (rowItems > 0) rows.push({ row, itemCount: rowItems });
    }

    return { items, rows, totalItems: items.length };
}

function detectWeaponsAndTomes(ctx, width, height) {
    const scale = height / 720;
    const p = WEAPON_TOME_GRID;
    const weapons = [], tomes = [];

    for (let row = 0; row < p.rows; row++) {
        for (let col = 0; col < p.cols; col++) {
            const iconSize = Math.round(p.iconSizeBase * scale);
            const x = Math.round(p.leftMarginBase * scale) + col * (iconSize + Math.round(p.spacingXBase * scale));
            const y = Math.round(p.topMarginBase * scale) + row * (iconSize + Math.round(p.spacingYBase * scale));

            const data = ctx.getImageData(x, y, iconSize, iconSize);
            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < data.data.length; i += 4) {
                const gray = (data.data[i] + data.data[i+1] + data.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;
            const isEmpty = variance < 500 || sum / count < 40;

            const slot = { slot: col + 1, x, y, width: iconSize, height: iconSize, isEmpty, variance };

            if (row === 0) weapons.push(slot);
            else tomes.push(slot);
        }
    }

    return {
        weapons: weapons.filter(w => !w.isEmpty),
        tomes: tomes.filter(t => !t.isEmpty),
        weaponCount: weapons.filter(w => !w.isEmpty).length,
        tomeCount: tomes.filter(t => !t.isEmpty).length
    };
}

function detectUIState(ctx, width, height) {
    // Check for inventory/chest popup by looking for dark overlay
    const centerData = ctx.getImageData(
        Math.round(width * 0.35),
        Math.round(height * 0.3),
        Math.round(width * 0.3),
        Math.round(height * 0.4)
    );

    let darkPixels = 0, totalPixels = centerData.data.length / 4;
    for (let i = 0; i < centerData.data.length; i += 4) {
        const brightness = (centerData.data[i] + centerData.data[i+1] + centerData.data[i+2]) / 3;
        if (brightness < 60) darkPixels++;
    }

    const darkRatio = darkPixels / totalPixels;

    // Check for inventory panel (left side dark region)
    const leftData = ctx.getImageData(0, Math.round(height * 0.2), Math.round(width * 0.15), Math.round(height * 0.5));
    let leftDark = 0;
    for (let i = 0; i < leftData.data.length; i += 4) {
        const b = (leftData.data[i] + leftData.data[i+1] + leftData.data[i+2]) / 3;
        if (b < 50) leftDark++;
    }
    const leftDarkRatio = leftDark / (leftData.data.length / 4);

    if (darkRatio > 0.5 && leftDarkRatio > 0.3) {
        return { state: 'inventory_popup', confidence: Math.min(1, darkRatio) };
    }

    return { state: 'gameplay', confidence: 1 - darkRatio };
}

function runValidation(data) {
    const checks = [];

    // Weapons in range
    checks.push({
        name: 'weapons_valid',
        passed: data.equipment.weaponCount >= 0 && data.equipment.weaponCount <= 4,
        value: data.equipment.weaponCount
    });

    // Tomes in range
    checks.push({
        name: 'tomes_valid',
        passed: data.equipment.tomeCount >= 0 && data.equipment.tomeCount <= 4,
        value: data.equipment.tomeCount
    });

    // Items reasonable
    checks.push({
        name: 'items_valid',
        passed: data.inventory.totalItems >= 0 && data.inventory.totalItems <= 60,
        value: data.inventory.totalItems
    });

    // Has some equipment
    checks.push({
        name: 'has_equipment',
        passed: data.equipment.weaponCount > 0 || data.equipment.tomeCount > 0,
        value: data.equipment.weaponCount + data.equipment.tomeCount
    });

    // Biome detected
    checks.push({
        name: 'biome_detected',
        passed: data.biome.biome !== 'unknown' && data.biome.confidence > 0.4,
        value: data.biome.confidence
    });

    const passed = checks.filter(c => c.passed).length;
    return { checks, passed, total: checks.length, score: passed / checks.length };
}

// ==================== MAIN ====================

async function analyzeScreenshot(imagePath, options = {}) {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const result = {
        file: path.basename(imagePath),
        resolution: { width: image.width, height: image.height },
        timestamp: new Date().toISOString()
    };

    // Detect UI state first
    result.uiState = detectUIState(ctx, image.width, image.height);

    // Detect biome
    result.biome = detectBiome(ctx, image.width, image.height);

    // Detect equipment
    result.equipment = detectWeaponsAndTomes(ctx, image.width, image.height);

    // Detect inventory (only in gameplay state)
    if (result.uiState.state === 'gameplay') {
        result.inventory = detectInventoryGrid(ctx, image.width, image.height);
    } else {
        result.inventory = { items: [], rows: [], totalItems: 0, note: 'Inventory popup detected - different detection needed' };
    }

    // Run validation
    result.validation = runValidation(result);

    // Calculate overall confidence
    result.overallConfidence = (
        result.biome.confidence * 0.2 +
        result.uiState.confidence * 0.2 +
        result.validation.score * 0.6
    );

    return result;
}

async function main() {
    const args = process.argv.slice(2);
    const jsonMode = args.includes('--json');
    const verbose = args.includes('--verbose');
    const imagePaths = args.filter(a => !a.startsWith('--'));

    if (imagePaths.length === 0) {
        // Run on all test images
        const GT_PATH = './test-images/gameplay/ground-truth.json';
        const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
        const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

        console.log('=== MegaBonk Screenshot Analyzer ===\n');
        console.log('| Image | UI State | Biome | Wpns | Tomes | Items | Valid | Conf |');
        console.log('|-------|----------|-------|------|-------|-------|-------|------|');

        const results = [];

        for (const [filename, data] of testCases) {
            const imagePath = path.join('./test-images/gameplay', filename);
            if (!fs.existsSync(imagePath)) continue;

            try {
                const result = await analyzeScreenshot(imagePath, { verbose });
                results.push(result);

                const shortName = filename.slice(9, 30);
                console.log(`| ${shortName.padEnd(21)} | ${result.uiState.state.slice(0, 8).padEnd(8)} | ${result.biome.biome.padEnd(6)} | ${String(result.equipment.weaponCount).padStart(4)} | ${String(result.equipment.tomeCount).padStart(5)} | ${String(result.inventory.totalItems).padStart(5)} | ${result.validation.passed}/${result.validation.total} | ${(result.overallConfidence * 100).toFixed(0).padStart(3)}% |`);
            } catch (err) {
                console.log(`| ${filename.slice(9, 30).padEnd(21)} | ERROR: ${err.message.slice(0, 40)} |`);
            }
        }

        console.log('|-------|----------|-------|------|-------|-------|-------|------|\n');

        // Summary
        const avgConf = results.reduce((s, r) => s + r.overallConfidence, 0) / results.length;
        const avgItems = results.reduce((s, r) => s + r.inventory.totalItems, 0) / results.length;
        console.log(`Analyzed: ${results.length} images`);
        console.log(`Average confidence: ${(avgConf * 100).toFixed(1)}%`);
        console.log(`Average items detected: ${avgItems.toFixed(1)}`);

        if (jsonMode) {
            fs.writeFileSync('./test-results/analysis-results.json', JSON.stringify(results, null, 2));
            console.log('\nJSON saved to: ./test-results/analysis-results.json');
        }

    } else {
        // Analyze specific image(s)
        for (const imagePath of imagePaths) {
            if (!fs.existsSync(imagePath)) {
                console.error(`File not found: ${imagePath}`);
                continue;
            }

            const result = await analyzeScreenshot(imagePath, { verbose });

            if (jsonMode) {
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(`\n=== Analysis: ${result.file} ===`);
                console.log(`Resolution: ${result.resolution.width}x${result.resolution.height}`);
                console.log(`UI State: ${result.uiState.state} (${(result.uiState.confidence * 100).toFixed(0)}%)`);
                console.log(`Biome: ${result.biome.biomeName} (${(result.biome.confidence * 100).toFixed(0)}%)`);
                console.log(`Weapons: ${result.equipment.weaponCount}/4`);
                console.log(`Tomes: ${result.equipment.tomeCount}/4`);
                console.log(`Items: ${result.inventory.totalItems}`);
                if (result.inventory.rows.length > 0) {
                    console.log(`  Rows: ${result.inventory.rows.map(r => `Row ${r.row}: ${r.itemCount}`).join(', ')}`);
                }
                console.log(`Validation: ${result.validation.passed}/${result.validation.total} checks passed`);
                if (verbose) {
                    for (const check of result.validation.checks) {
                        console.log(`  ${check.passed ? '✓' : '✗'} ${check.name}: ${check.value}`);
                    }
                }
                console.log(`Overall Confidence: ${(result.overallConfidence * 100).toFixed(0)}%`);
            }
        }
    }
}

main().catch(console.error);
