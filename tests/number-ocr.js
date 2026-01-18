#!/usr/bin/env node
// OCR for game numbers (levels, stats) using template matching

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/number-ocr';

// Digit templates will be extracted from screenshots
// Game uses pixel font - digits are typically 5-8 pixels wide

// Simple binarization for text extraction
function binarize(imageData, threshold = 128) {
    const result = new Uint8Array(imageData.width * imageData.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        result[i / 4] = gray > threshold ? 1 : 0;
    }
    return { data: result, width: imageData.width, height: imageData.height };
}

// Find bright text regions (white/yellow text on dark background)
function findTextRegions(imageData) {
    const w = imageData.width, h = imageData.height;
    const regions = [];

    // Scan for bright pixels that could be text
    const brightness = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        brightness[i] = (r + g + b) / 3;
    }

    // Find connected bright regions
    const visited = new Uint8Array(w * h);
    const BRIGHT_THRESHOLD = 180;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (visited[idx] || brightness[idx] < BRIGHT_THRESHOLD) continue;

            // Flood fill to find connected region
            const region = { minX: x, maxX: x, minY: y, maxY: y, pixels: [] };
            const queue = [[x, y]];

            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                const cidx = cy * w + cx;

                if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
                if (visited[cidx] || brightness[cidx] < BRIGHT_THRESHOLD) continue;

                visited[cidx] = 1;
                region.pixels.push([cx, cy]);
                region.minX = Math.min(region.minX, cx);
                region.maxX = Math.max(region.maxX, cx);
                region.minY = Math.min(region.minY, cy);
                region.maxY = Math.max(region.maxY, cy);

                queue.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
            }

            // Filter by size (digits are typically 4-12 pixels wide, 6-16 tall)
            const width = region.maxX - region.minX + 1;
            const height = region.maxY - region.minY + 1;

            if (width >= 3 && width <= 20 && height >= 5 && height <= 25 && region.pixels.length >= 10) {
                regions.push(region);
            }
        }
    }

    return regions;
}

// Extract character from region
function extractCharacter(imageData, region, targetSize = 16) {
    const width = region.maxX - region.minX + 1;
    const height = region.maxY - region.minY + 1;

    // Create small canvas for character
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Copy pixels
    const charData = ctx.createImageData(width, height);
    for (const [x, y] of region.pixels) {
        const srcIdx = (y * imageData.width + x) * 4;
        const dstIdx = ((y - region.minY) * width + (x - region.minX)) * 4;
        charData.data[dstIdx] = imageData.data[srcIdx];
        charData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        charData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        charData.data[dstIdx + 3] = 255;
    }
    ctx.putImageData(charData, 0, 0);

    // Resize to standard size
    const resultCanvas = createCanvas(targetSize, targetSize);
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.fillStyle = '#000';
    resultCtx.fillRect(0, 0, targetSize, targetSize);

    // Center the character
    const scale = Math.min(targetSize / width, targetSize / height) * 0.8;
    const scaledW = width * scale;
    const scaledH = height * scale;
    const offsetX = (targetSize - scaledW) / 2;
    const offsetY = (targetSize - scaledH) / 2;

    resultCtx.drawImage(canvas, offsetX, offsetY, scaledW, scaledH);

    return resultCtx.getImageData(0, 0, targetSize, targetSize);
}

// Simple pattern matching for digits
// Returns similarity score
function matchPattern(charData, pattern) {
    let matches = 0;
    let total = 0;

    for (let i = 0; i < charData.data.length; i += 4) {
        const charBright = (charData.data[i] + charData.data[i+1] + charData.data[i+2]) / 3 > 128 ? 1 : 0;
        const patBright = pattern[i / 4] || 0;

        if (charBright === patBright) matches++;
        total++;
    }

    return matches / total;
}

// Calibrated UI positions for numbers (based on 1600x900 reference)
// These scale with resolution
const NUMBER_LOCATIONS = {
    // Level display "LVL XX" in top-right corner
    playerLevel: {
        xPercent: 0.90,
        yPercent: 0.005,
        widthPercent: 0.08,
        heightPercent: 0.035
    },
    // Timer (center top, red text)
    timer: {
        xPercent: 0.46,
        yPercent: 0.005,
        widthPercent: 0.08,
        heightPercent: 0.035
    },
    // Gold (after coins icon, right of timer)
    gold: {
        xPercent: 0.85,
        yPercent: 0.005,
        widthPercent: 0.05,
        heightPercent: 0.03
    },
    // XP/Kills counter (left of timer)
    kills: {
        xPercent: 0.33,
        yPercent: 0.005,
        widthPercent: 0.05,
        heightPercent: 0.03
    }
};

// Simple digit recognition using aspect ratio and pixel density
function recognizeDigit(charData) {
    const w = charData.width, h = charData.height;
    let brightPixels = 0;
    let topHalf = 0, bottomHalf = 0;
    let leftHalf = 0, rightHalf = 0;
    let center = 0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const bright = (charData.data[idx] + charData.data[idx+1] + charData.data[idx+2]) / 3 > 128;

            if (bright) {
                brightPixels++;
                if (y < h / 2) topHalf++;
                else bottomHalf++;
                if (x < w / 2) leftHalf++;
                else rightHalf++;
                if (x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7) center++;
            }
        }
    }

    const density = brightPixels / (w * h);
    const topRatio = topHalf / (brightPixels || 1);
    const leftRatio = leftHalf / (brightPixels || 1);
    const centerRatio = center / (brightPixels || 1);

    // Heuristic digit recognition based on shape
    // This is approximate - real implementation would use trained templates

    if (density < 0.1) return null;

    // 1 is narrow
    if (density < 0.25 && leftRatio > 0.6) return '1';

    // 0 has hole in center (low center ratio)
    if (centerRatio < 0.15 && density > 0.3) return '0';

    // 8 is very dense
    if (density > 0.45) return '8';

    // Return confidence-based guess
    const guesses = [
        { digit: '0', score: (1 - centerRatio) * 0.5 + (density > 0.3 ? 0.3 : 0) },
        { digit: '1', score: density < 0.3 ? 0.5 : 0 },
        { digit: '2', score: topRatio > 0.4 && topRatio < 0.6 ? 0.3 : 0 },
        { digit: '3', score: rightHalf > leftHalf ? 0.2 : 0 },
        { digit: '4', score: topRatio > 0.5 ? 0.2 : 0 },
        { digit: '5', score: leftRatio > 0.5 ? 0.2 : 0 },
        { digit: '6', score: bottomHalf > topHalf && leftRatio > 0.4 ? 0.3 : 0 },
        { digit: '7', score: topRatio > 0.5 && rightHalf > leftHalf ? 0.2 : 0 },
        { digit: '8', score: density > 0.4 ? 0.4 : 0 },
        { digit: '9', score: topHalf > bottomHalf && rightHalf > 0.4 ? 0.3 : 0 },
    ];

    guesses.sort((a, b) => b.score - a.score);
    return guesses[0].score > 0.2 ? guesses[0].digit : '?';
}

// Read number from region
function readNumberFromRegion(ctx, region) {
    const x = Math.round(region.xPercent * ctx.canvas.width);
    const y = Math.round(region.yPercent * ctx.canvas.height);
    const w = Math.round(region.widthPercent * ctx.canvas.width);
    const h = Math.round(region.heightPercent * ctx.canvas.height);

    const imageData = ctx.getImageData(x, y, w, h);
    const textRegions = findTextRegions(imageData);

    // Sort regions left to right
    textRegions.sort((a, b) => a.minX - b.minX);

    let number = '';
    for (const textRegion of textRegions) {
        const charData = extractCharacter(imageData, textRegion);
        const digit = recognizeDigit(charData);
        if (digit) number += digit;
    }

    return { number, regions: textRegions, x, y, w, h };
}

async function main() {
    console.log('=== Number OCR ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Level | Timer | Gold |');
    console.log('|-------|-------|-------|------|');

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // Read numbers from known locations
        const levelResult = readNumberFromRegion(ctx, NUMBER_LOCATIONS.playerLevel);
        const timerResult = readNumberFromRegion(ctx, NUMBER_LOCATIONS.timer);
        const goldResult = readNumberFromRegion(ctx, NUMBER_LOCATIONS.gold);

        const shortName = filename.slice(9, 35);
        console.log(`| ${shortName.padEnd(25)} | ${levelResult.number.padStart(5)} | ${timerResult.number.padStart(5)} | ${goldResult.number.padStart(4)} |`);

        // Create visualization
        const vizCanvas = createCanvas(image.width, image.height + 80);
        const vizCtx = vizCanvas.getContext('2d');
        vizCtx.drawImage(image, 0, 0);

        // Draw search regions
        vizCtx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        vizCtx.lineWidth = 2;

        for (const [name, region] of Object.entries(NUMBER_LOCATIONS)) {
            if (Array.isArray(region)) continue;
            const x = Math.round(region.xPercent * image.width);
            const y = Math.round(region.yPercent * image.height);
            const w = Math.round(region.widthPercent * image.width);
            const h = Math.round(region.heightPercent * image.height);
            vizCtx.strokeRect(x, y, w, h);
        }

        // Info panel
        vizCtx.fillStyle = '#1a1a2e';
        vizCtx.fillRect(0, image.height, image.width, 80);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '14px monospace';

        vizCtx.fillText(`Level: ${levelResult.number || 'N/A'}`, 10, image.height + 25);
        vizCtx.fillText(`Timer: ${timerResult.number || 'N/A'}`, 10, image.height + 50);
        vizCtx.fillText(`Gold: ${goldResult.number || 'N/A'}`, 200, image.height + 25);

        // Expected from filename
        const levelMatch = filename.match(/level_(\d+)/);
        if (levelMatch) {
            vizCtx.fillText(`Expected Level: ${levelMatch[1]}`, 200, image.height + 50);
        }

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `ocr_${filename.replace(/[\/\.]/g, '_')}.png`),
            vizCanvas.toBuffer('image/png')
        );
    }

    console.log('|-------|-------|-------|------|');
    console.log(`\nVisualizations saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
