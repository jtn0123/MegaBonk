#!/usr/bin/env node
// Detect weapon and tome level numbers from the upgrade indicators on icons

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/weapon-tome-levels';

// Grid parameters (from weapon-tome-identifier.js)
const GRID_PARAMS = {
    leftMarginBase: 6,
    topMarginBase: 135,
    iconSizeBase: 32,
    spacingXBase: 10,
    spacingYBase: 45,
    cols: 4,
    rows: 2
};

// Level indicator appears in bottom-right corner of each icon
// It's a small number (1-8) showing upgrade level
const LEVEL_INDICATOR = {
    offsetXPercent: 0.55,  // Right side of icon
    offsetYPercent: 0.55,  // Bottom of icon
    widthPercent: 0.45,
    heightPercent: 0.45
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

// Extract level indicator region from icon
function getLevelRegion(ctx, pos) {
    const x = Math.round(pos.x + pos.width * LEVEL_INDICATOR.offsetXPercent);
    const y = Math.round(pos.y + pos.height * LEVEL_INDICATOR.offsetYPercent);
    const w = Math.round(pos.width * LEVEL_INDICATOR.widthPercent);
    const h = Math.round(pos.height * LEVEL_INDICATOR.heightPercent);

    return { x, y, w, h, imageData: ctx.getImageData(x, y, w, h) };
}

// Recognize level number (1-8) from small region
// Uses simple heuristics based on pixel patterns
function recognizeLevelNumber(imageData) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;

    // Find bright pixels (level numbers are usually white/yellow)
    let brightPixels = [];
    let totalBright = 0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2];
            const brightness = (r + g + b) / 3;

            // Check for white/yellow text (high brightness, not red/purple)
            if (brightness > 150 && g > 100) {
                brightPixels.push({ x, y, brightness });
                totalBright++;
            }
        }
    }

    if (totalBright < 3) {
        return { level: null, confidence: 0, reason: 'too few bright pixels' };
    }

    // Analyze shape of bright region
    const minX = Math.min(...brightPixels.map(p => p.x));
    const maxX = Math.max(...brightPixels.map(p => p.x));
    const minY = Math.min(...brightPixels.map(p => p.y));
    const maxY = Math.max(...brightPixels.map(p => p.y));

    const charWidth = maxX - minX + 1;
    const charHeight = maxY - minY + 1;
    const aspectRatio = charWidth / charHeight;

    // Count pixels in different regions
    let topHalf = 0, bottomHalf = 0;
    let leftHalf = 0, rightHalf = 0;
    let center = 0;
    const midY = (minY + maxY) / 2;
    const midX = (minX + maxX) / 2;

    for (const p of brightPixels) {
        if (p.y < midY) topHalf++;
        else bottomHalf++;
        if (p.x < midX) leftHalf++;
        else rightHalf++;
        if (p.x > minX + charWidth * 0.25 && p.x < maxX - charWidth * 0.25 &&
            p.y > minY + charHeight * 0.25 && p.y < maxY - charHeight * 0.25) {
            center++;
        }
    }

    const density = totalBright / (charWidth * charHeight);
    const topRatio = topHalf / totalBright;
    const leftRatio = leftHalf / totalBright;
    const centerRatio = center / totalBright;

    // Heuristic digit recognition
    // 1: Very narrow, most pixels on right
    if (aspectRatio < 0.4 || (charWidth <= 3 && leftRatio < 0.4)) {
        return { level: 1, confidence: 0.7, reason: 'narrow shape' };
    }

    // 8: Dense, roughly symmetric
    if (density > 0.5 && Math.abs(topRatio - 0.5) < 0.15) {
        return { level: 8, confidence: 0.6, reason: 'dense symmetric' };
    }

    // 0: Has hole in center (low center ratio)
    if (centerRatio < 0.1 && density > 0.3) {
        return { level: 0, confidence: 0.5, reason: 'hollow center' };
    }

    // 7: Heavy top, light bottom
    if (topRatio > 0.65) {
        return { level: 7, confidence: 0.5, reason: 'top-heavy' };
    }

    // 4: Heavy top-left, diagonal
    if (topRatio > 0.55 && leftRatio > 0.55) {
        return { level: 4, confidence: 0.5, reason: 'top-left heavy' };
    }

    // 6: Bottom heavy, left heavy
    if (bottomHalf > topHalf && leftRatio > 0.5) {
        return { level: 6, confidence: 0.5, reason: 'bottom-left heavy' };
    }

    // 9: Top heavy, right heavy
    if (topHalf > bottomHalf && rightHalf > leftHalf) {
        return { level: 9, confidence: 0.4, reason: 'top-right heavy' };
    }

    // 2, 3, 5 are harder to distinguish
    if (rightHalf > leftHalf) {
        return { level: 3, confidence: 0.4, reason: 'right heavy' };
    }

    if (leftRatio > 0.5 && bottomHalf > topHalf) {
        return { level: 5, confidence: 0.4, reason: 'left-bottom heavy' };
    }

    return { level: 2, confidence: 0.3, reason: 'default' };
}

// Alternative: Look for the upgrade bar/pips below icons
function detectUpgradeBars(ctx, pos) {
    // Upgrade progress might show as colored bars/pips below the icon
    const barY = pos.y + pos.height + 2;
    const barH = 4;

    if (barY + barH >= ctx.canvas.height) return null;

    const barData = ctx.getImageData(pos.x, barY, pos.width, barH);

    // Look for colored segments (yellow/gold for filled upgrades)
    let yellowPixels = 0;
    for (let i = 0; i < barData.data.length; i += 4) {
        const r = barData.data[i], g = barData.data[i+1], b = barData.data[i+2];
        // Yellow/gold: high R and G, low B
        if (r > 150 && g > 120 && b < 100) {
            yellowPixels++;
        }
    }

    const fillRatio = yellowPixels / (barData.width * barData.height);

    // Estimate level from fill ratio (0-100% = level 1-8)
    if (fillRatio > 0.1) {
        const estimatedLevel = Math.min(8, Math.max(1, Math.round(fillRatio * 8)));
        return { level: estimatedLevel, confidence: 0.4, method: 'upgrade-bar', fillRatio };
    }

    return null;
}

async function main() {
    console.log('=== Weapon/Tome Level Detection ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Weapon Levels | Tome Levels |');
    console.log('|-------|---------------|-------------|');

    const allResults = [];

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const { positions, iconSize, scale } = detectWeaponTomeGrid(image.width, image.height);

        const weaponLevels = [];
        const tomeLevels = [];

        for (const pos of positions) {
            if (isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height)) {
                continue;
            }

            // Try level number recognition
            const levelRegion = getLevelRegion(ctx, pos);
            const levelResult = recognizeLevelNumber(levelRegion.imageData);

            // Also try upgrade bar detection
            const barResult = detectUpgradeBars(ctx, pos);

            // Combine results
            let finalLevel = null;
            let confidence = 0;

            if (levelResult.level !== null && levelResult.confidence > 0.4) {
                finalLevel = levelResult.level;
                confidence = levelResult.confidence;
            } else if (barResult && barResult.level) {
                finalLevel = barResult.level;
                confidence = barResult.confidence;
            }

            const result = {
                slot: pos.col + 1,
                type: pos.type,
                level: finalLevel,
                confidence,
                levelResult,
                barResult
            };

            if (pos.type === 'weapon') {
                weaponLevels.push(result);
            } else {
                tomeLevels.push(result);
            }
        }

        const shortName = filename.slice(9, 35);
        const wLevels = weaponLevels.map(w => w.level || '?').join(',');
        const tLevels = tomeLevels.map(t => t.level || '?').join(',');

        console.log(`| ${shortName.padEnd(25)} | ${wLevels.padEnd(13)} | ${tLevels.padEnd(11)} |`);

        allResults.push({
            filename,
            weaponLevels,
            tomeLevels
        });

        // Create visualization
        const vizCanvas = createCanvas(image.width, image.height + 100);
        const vizCtx = vizCanvas.getContext('2d');
        vizCtx.drawImage(image, 0, 0);

        // Draw detected slots with levels
        for (const pos of positions) {
            const isEmpty = isEmptySlot(ctx, pos.x, pos.y, pos.width, pos.height);

            if (!isEmpty) {
                // Draw icon border
                vizCtx.strokeStyle = pos.type === 'weapon' ? 'rgba(255, 100, 0, 0.9)' : 'rgba(100, 200, 255, 0.9)';
                vizCtx.lineWidth = 2;
                vizCtx.strokeRect(pos.x, pos.y, pos.width, pos.height);

                // Draw level indicator region
                const lr = getLevelRegion(ctx, pos);
                vizCtx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
                vizCtx.lineWidth = 1;
                vizCtx.strokeRect(lr.x, lr.y, lr.w, lr.h);

                // Find and display detected level
                const levels = pos.type === 'weapon' ? weaponLevels : tomeLevels;
                const slotLevel = levels.find(l => l.slot === pos.col + 1);

                if (slotLevel && slotLevel.level !== null) {
                    vizCtx.fillStyle = '#fff';
                    vizCtx.font = 'bold 10px monospace';
                    vizCtx.fillText(`L${slotLevel.level}`, pos.x + 2, pos.y + 10);
                }
            }
        }

        // Info panel
        vizCtx.fillStyle = '#1a1a2e';
        vizCtx.fillRect(0, image.height, image.width, 100);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '12px monospace';

        const wInfo = weaponLevels.map(w => `W${w.slot}:${w.level || '?'}`).join(' ');
        const tInfo = tomeLevels.map(t => `T${t.slot}:${t.level || '?'}`).join(' ');

        vizCtx.fillText(`Weapons: ${wInfo || 'none detected'}`, 10, image.height + 25);
        vizCtx.fillText(`Tomes: ${tInfo || 'none detected'}`, 10, image.height + 50);

        // Confidence breakdown
        const avgWConf = weaponLevels.length > 0
            ? (weaponLevels.reduce((s, w) => s + w.confidence, 0) / weaponLevels.length * 100).toFixed(0)
            : 'N/A';
        const avgTConf = tomeLevels.length > 0
            ? (tomeLevels.reduce((s, t) => s + t.confidence, 0) / tomeLevels.length * 100).toFixed(0)
            : 'N/A';

        vizCtx.fillText(`Confidence: Weapons ${avgWConf}%, Tomes ${avgTConf}%`, 10, image.height + 75);

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `levels_${filename.replace(/[\/\.]/g, '_')}.png`),
            vizCanvas.toBuffer('image/png')
        );
    }

    console.log('|-------|---------------|-------------|');

    // Summary
    const allWeaponLevels = allResults.flatMap(r => r.weaponLevels);
    const allTomeLevels = allResults.flatMap(r => r.tomeLevels);

    const detectedWeapons = allWeaponLevels.filter(w => w.level !== null).length;
    const detectedTomes = allTomeLevels.filter(t => t.level !== null).length;

    console.log(`\nDetected levels: ${detectedWeapons}/${allWeaponLevels.length} weapons, ${detectedTomes}/${allTomeLevels.length} tomes`);

    if (detectedWeapons > 0) {
        const avgConf = allWeaponLevels.filter(w => w.level !== null)
            .reduce((s, w) => s + w.confidence, 0) / detectedWeapons;
        console.log(`Average weapon level confidence: ${(avgConf * 100).toFixed(1)}%`);
    }

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'results.json'),
        JSON.stringify(allResults, null, 2)
    );

    console.log(`\nResults saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
