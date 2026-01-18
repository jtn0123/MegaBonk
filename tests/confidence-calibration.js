#!/usr/bin/env node
// Confidence calibration using cross-validation between detectors

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/confidence-calibration';

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

    return { biome: bestBiome, rawConfidence: bestScore / 15, avgColor: avg };
}

// ==================== ITEM DETECTION ====================
function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    const rowYPositions = [];
    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y >= height * 0.70) rowYPositions.push(y);
    }

    const sideMargin = Math.round(width * 0.15);
    const cellWidth = iconSize + spacing;
    const maxItemsPerRow = Math.min(20, Math.floor((width - sideMargin * 2) / cellWidth));
    const totalWidth = maxItemsPerRow * cellWidth;
    const startX = Math.round((width - totalWidth) / 2);

    for (const rowY of rowYPositions) {
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize });
        }
    }
    return positions;
}

function countInventoryItems(ctx, width, height) {
    const positions = detectGridPositions(width, height);
    let itemCount = 0;

    for (const pos of positions) {
        const data = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
        let sum = 0, sumSq = 0, count = 0;
        for (let i = 0; i < data.data.length; i += 4) {
            const gray = (data.data[i] + data.data[i+1] + data.data[i+2]) / 3;
            sum += gray; sumSq += gray * gray; count++;
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        if (variance >= 350 && mean >= 30) itemCount++;
    }

    return { itemCount, gridSlots: positions.length };
}

// ==================== WEAPON/TOME DETECTION ====================
const WEAPON_TOME_GRID = {
    leftMarginBase: 6, topMarginBase: 135, iconSizeBase: 32,
    spacingXBase: 10, spacingYBase: 45, cols: 4, rows: 2
};

function countWeaponsAndTomes(ctx, width, height) {
    const scale = height / 720;
    const p = WEAPON_TOME_GRID;
    let weaponCount = 0, tomeCount = 0;

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

            if (!isEmpty) {
                if (row === 0) weaponCount++;
                else tomeCount++;
            }
        }
    }

    return { weaponCount, tomeCount };
}

// ==================== CROSS-VALIDATION RULES ====================
const VALIDATION_RULES = [
    {
        name: 'weapons_in_range',
        check: (data) => data.weaponCount >= 0 && data.weaponCount <= 4,
        weight: 1.0,
        affects: ['weapons']
    },
    {
        name: 'tomes_in_range',
        check: (data) => data.tomeCount >= 0 && data.tomeCount <= 4,
        weight: 1.0,
        affects: ['tomes']
    },
    {
        name: 'items_reasonable',
        check: (data) => data.itemCount >= 0 && data.itemCount <= 60,
        weight: 0.8,
        affects: ['items']
    },
    {
        name: 'hell_high_items',
        check: (data) => data.biome !== 'hell' || data.itemCount >= 15,
        weight: 0.5,
        affects: ['biome', 'items'],
        description: 'Hell biome usually means late game with many items'
    },
    {
        name: 'forest_low_items',
        check: (data) => data.biome !== 'forest' || data.itemCount <= 25,
        weight: 0.5,
        affects: ['biome', 'items'],
        description: 'Forest is early game, usually fewer items'
    },
    {
        name: 'equipped_consistency',
        check: (data) => data.weaponCount > 0 || data.tomeCount > 0,
        weight: 0.7,
        affects: ['weapons', 'tomes'],
        description: 'Should have at least some equipment'
    },
    {
        name: 'late_game_consistency',
        check: (data) => {
            // If player has 4 weapons and 4 tomes, items should be high
            if (data.weaponCount === 4 && data.tomeCount === 4) {
                return data.itemCount >= 10;
            }
            return true;
        },
        weight: 0.6,
        affects: ['weapons', 'tomes', 'items'],
        description: 'Full equipment means late game'
    },
    {
        name: 'biome_color_confidence',
        check: (data) => data.biomeRawConfidence > 0.4,
        weight: 0.8,
        affects: ['biome'],
        description: 'Biome color should be clearly identifiable'
    }
];

function runValidation(detectionData) {
    const results = [];
    let totalWeight = 0;
    let passedWeight = 0;

    for (const rule of VALIDATION_RULES) {
        const passed = rule.check(detectionData);
        results.push({
            name: rule.name,
            passed,
            weight: rule.weight,
            affects: rule.affects,
            description: rule.description
        });
        totalWeight += rule.weight;
        if (passed) passedWeight += rule.weight;
    }

    return {
        results,
        overallScore: passedWeight / totalWeight,
        passedCount: results.filter(r => r.passed).length,
        totalCount: results.length
    };
}

// ==================== CONFIDENCE CALIBRATION ====================
function calibrateConfidence(rawConfidence, validationScore, baselineAccuracy = 0.5) {
    // Bayesian-style calibration:
    // P(correct | raw, validation) ∝ P(raw | correct) * P(validation | correct) * P(correct)

    // If validation passes, boost confidence
    // If validation fails, reduce confidence

    const validationFactor = 0.5 + validationScore * 0.5; // 0.5 to 1.0
    const calibrated = rawConfidence * validationFactor;

    // Clamp to reasonable range
    return Math.max(0.1, Math.min(0.95, calibrated));
}

// ==================== MAIN ====================
async function main() {
    console.log('=== Confidence Calibration with Cross-Validation ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Biome | Items | Wpns | Tomes | Valid | Calibrated |');
    console.log('|-------|-------|-------|------|-------|-------|------------|');

    const allResults = [];
    let totalRaw = 0, totalCalibrated = 0, count = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // Run all detectors
        const biome = detectBiome(ctx, image.width, image.height);
        const inventory = countInventoryItems(ctx, image.width, image.height);
        const equipment = countWeaponsAndTomes(ctx, image.width, image.height);

        // Combine detection data
        const detectionData = {
            biome: biome.biome,
            biomeRawConfidence: biome.rawConfidence,
            itemCount: inventory.itemCount,
            weaponCount: equipment.weaponCount,
            tomeCount: equipment.tomeCount
        };

        // Run validation
        const validation = runValidation(detectionData);

        // Calibrate confidence
        const calibratedBiome = calibrateConfidence(biome.rawConfidence, validation.overallScore, 0.625);

        const shortName = filename.slice(9, 30);

        console.log(`| ${shortName.padEnd(20)} | ${biome.biome.padEnd(6)} | ${String(inventory.itemCount).padStart(5)} | ${String(equipment.weaponCount).padStart(4)} | ${String(equipment.tomeCount).padStart(5)} | ${validation.passedCount}/${validation.totalCount} | ${(calibratedBiome * 100).toFixed(0).padStart(9)}% |`);

        totalRaw += biome.rawConfidence;
        totalCalibrated += calibratedBiome;
        count++;

        allResults.push({
            filename,
            biome: biome.biome,
            biomeRawConfidence: biome.rawConfidence,
            biomeCalibratedConfidence: calibratedBiome,
            itemCount: inventory.itemCount,
            weaponCount: equipment.weaponCount,
            tomeCount: equipment.tomeCount,
            validation: {
                score: validation.overallScore,
                passed: validation.passedCount,
                total: validation.totalCount,
                details: validation.results
            },
            groundTruth: {
                biome: data.biome,
                itemCount: data.items?.length
            }
        });
    }

    console.log('|-------|-------|-------|------|-------|-------|------------|');

    // Summary statistics
    console.log('\n=== Calibration Summary ===');
    console.log(`Average raw biome confidence: ${(totalRaw / count * 100).toFixed(1)}%`);
    console.log(`Average calibrated confidence: ${(totalCalibrated / count * 100).toFixed(1)}%`);

    // Check accuracy against ground truth
    let biomeCorrect = 0;
    for (const result of allResults) {
        if (result.groundTruth.biome && result.biome === result.groundTruth.biome) {
            biomeCorrect++;
        }
    }
    console.log(`\nBiome accuracy: ${biomeCorrect}/${allResults.length} (${(biomeCorrect / allResults.length * 100).toFixed(0)}%)`);

    // Validation rule statistics
    console.log('\n=== Validation Rule Statistics ===');
    const ruleCounts = {};
    for (const result of allResults) {
        for (const detail of result.validation.details) {
            if (!ruleCounts[detail.name]) {
                ruleCounts[detail.name] = { passed: 0, failed: 0 };
            }
            if (detail.passed) ruleCounts[detail.name].passed++;
            else ruleCounts[detail.name].failed++;
        }
    }

    console.log('| Rule | Passed | Failed | Rate |');
    console.log('|------|--------|--------|------|');
    for (const [rule, counts] of Object.entries(ruleCounts)) {
        const rate = counts.passed / (counts.passed + counts.failed) * 100;
        console.log(`| ${rule.padEnd(25)} | ${String(counts.passed).padStart(6)} | ${String(counts.failed).padStart(6)} | ${rate.toFixed(0).padStart(3)}% |`);
    }

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'calibration-results.json'),
        JSON.stringify({
            summary: {
                avgRawConfidence: totalRaw / count,
                avgCalibratedConfidence: totalCalibrated / count,
                biomeAccuracy: biomeCorrect / allResults.length
            },
            ruleStats: ruleCounts,
            validationRules: VALIDATION_RULES.map(r => ({
                name: r.name,
                weight: r.weight,
                affects: r.affects,
                description: r.description
            })),
            results: allResults
        }, null, 2)
    );

    console.log(`\nResults saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
