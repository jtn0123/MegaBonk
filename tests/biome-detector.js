#!/usr/bin/env node
// Detect biome/environment from screenshot using color analysis

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/biome-detection';

// Calibrated biome signatures based on actual screenshot measurements
const BIOME_SIGNATURES = {
    forest: {
        // Measured: R=80, G=67, B=127 (purple fog dominates)
        dominant: { r: [60, 100], g: [50, 90], b: [100, 150] },
        description: 'Purple/blue fog with green trees'
    },
    desert: {
        // Measured: R=101, G=114, B=135 (grayish-blue, distant view)
        dominant: { r: [85, 125], g: [95, 135], b: [115, 155] },
        description: 'Grayish-tan sandy colors'
    },
    snow: {
        // Measured: R=114, G=124, B=138 (gray-blue, bright)
        dominant: { r: [100, 140], g: [110, 150], b: [125, 165] },
        description: 'Bright gray-blue'
    },
    hell: {
        // Measured: R=112-120, G=43-68, B=33-60 (R much higher than G,B)
        dominant: { r: [100, 140], g: [35, 85], b: [25, 75] },
        description: 'Red/orange fire colors'
    },
    ocean: {
        // Measured: R=24, G=125, B=159 (very blue-green, very low R)
        dominant: { r: [10, 60], g: [100, 150], b: [130, 180] },
        description: 'Blue-green water'
    },
    crypt: {
        // Measured: R=106, G=88, B=111 (purple-gray, G lowest)
        dominant: { r: [85, 125], g: [70, 105], b: [90, 130] },
        description: 'Purple-gray stone'
    }
};

function extractBackgroundRegion(ctx, width, height) {
    // Sample from middle area avoiding UI elements
    // Avoid: top (health bars), bottom (inventory), left (weapons), right (minimap)
    const regions = [
        { x: width * 0.3, y: height * 0.25, w: width * 0.4, h: height * 0.3 }, // Center
        { x: width * 0.2, y: height * 0.4, w: width * 0.2, h: height * 0.2 },  // Left-mid
        { x: width * 0.6, y: height * 0.4, w: width * 0.2, h: height * 0.2 },  // Right-mid
    ];

    const allPixels = [];

    for (const region of regions) {
        const imageData = ctx.getImageData(
            Math.round(region.x), Math.round(region.y),
            Math.round(region.w), Math.round(region.h)
        );

        for (let i = 0; i < imageData.data.length; i += 4) {
            allPixels.push({
                r: imageData.data[i],
                g: imageData.data[i + 1],
                b: imageData.data[i + 2]
            });
        }
    }

    return allPixels;
}

function computeColorHistogram(pixels, bins = 8) {
    const histogram = {
        r: new Array(bins).fill(0),
        g: new Array(bins).fill(0),
        b: new Array(bins).fill(0)
    };

    const binSize = 256 / bins;

    for (const p of pixels) {
        histogram.r[Math.min(bins - 1, Math.floor(p.r / binSize))]++;
        histogram.g[Math.min(bins - 1, Math.floor(p.g / binSize))]++;
        histogram.b[Math.min(bins - 1, Math.floor(p.b / binSize))]++;
    }

    // Normalize
    const total = pixels.length;
    for (let i = 0; i < bins; i++) {
        histogram.r[i] /= total;
        histogram.g[i] /= total;
        histogram.b[i] /= total;
    }

    return histogram;
}

function computeAverageColor(pixels) {
    let sumR = 0, sumG = 0, sumB = 0;
    for (const p of pixels) {
        sumR += p.r;
        sumG += p.g;
        sumB += p.b;
    }
    const n = pixels.length;
    return { r: sumR / n, g: sumG / n, b: sumB / n };
}

function computeColorVariance(pixels, avg) {
    let varR = 0, varG = 0, varB = 0;
    for (const p of pixels) {
        varR += (p.r - avg.r) ** 2;
        varG += (p.g - avg.g) ** 2;
        varB += (p.b - avg.b) ** 2;
    }
    const n = pixels.length;
    return { r: Math.sqrt(varR / n), g: Math.sqrt(varG / n), b: Math.sqrt(varB / n) };
}

function inRange(value, range) {
    return value >= range[0] && value <= range[1];
}

function scoreBiome(avg, variance, signature) {
    let score = 0;

    // Check dominant color
    if (inRange(avg.r, signature.dominant.r)) score += 2;
    if (inRange(avg.g, signature.dominant.g)) score += 2;
    if (inRange(avg.b, signature.dominant.b)) score += 2;

    // Partial match bonus
    const rDist = Math.min(
        Math.abs(avg.r - signature.dominant.r[0]),
        Math.abs(avg.r - signature.dominant.r[1])
    );
    const gDist = Math.min(
        Math.abs(avg.g - signature.dominant.g[0]),
        Math.abs(avg.g - signature.dominant.g[1])
    );
    const bDist = Math.min(
        Math.abs(avg.b - signature.dominant.b[0]),
        Math.abs(avg.b - signature.dominant.b[1])
    );

    // Distance-based scoring (closer = higher score)
    score += Math.max(0, 3 - rDist / 30);
    score += Math.max(0, 3 - gDist / 30);
    score += Math.max(0, 3 - bDist / 30);

    return score;
}

function detectBiome(pixels) {
    const avg = computeAverageColor(pixels);
    const variance = computeColorVariance(pixels, avg);
    const histogram = computeColorHistogram(pixels);

    const scores = {};
    for (const [biome, signature] of Object.entries(BIOME_SIGNATURES)) {
        scores[biome] = scoreBiome(avg, variance, signature);
    }

    // Find best match
    let bestBiome = null;
    let bestScore = -1;
    for (const [biome, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestBiome = biome;
        }
    }

    return {
        detected: bestBiome,
        confidence: bestScore / 15, // Normalize to 0-1
        scores,
        avgColor: avg,
        variance
    };
}

function extractBiomeFromFilename(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('forest')) return 'forest';
    if (lower.includes('desert')) return 'desert';
    if (lower.includes('snow')) return 'snow';
    if (lower.includes('hell')) return 'hell';
    if (lower.includes('ocean')) return 'ocean';
    if (lower.includes('crypt')) return 'crypt';
    return 'unknown';
}

async function main() {
    console.log('=== Biome Detection ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    console.log('| Image | Actual | Detected | Confidence | Match |');
    console.log('|-------|--------|----------|------------|-------|');

    let correct = 0;
    let total = 0;
    const results = [];

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const pixels = extractBackgroundRegion(ctx, image.width, image.height);
        const result = detectBiome(pixels);

        const actualBiome = extractBiomeFromFilename(filename);
        const isCorrect = result.detected === actualBiome;

        if (actualBiome !== 'unknown') {
            total++;
            if (isCorrect) correct++;
        }

        const shortName = filename.slice(9, 35);
        const match = isCorrect ? '✓' : '✗';
        console.log(`| ${shortName.padEnd(25)} | ${actualBiome.padEnd(6)} | ${result.detected.padEnd(8)} | ${(result.confidence * 100).toFixed(0).padStart(9)}% | ${match.padStart(5)} |`);

        results.push({
            filename,
            actual: actualBiome,
            detected: result.detected,
            confidence: result.confidence,
            correct: isCorrect,
            avgColor: result.avgColor,
            scores: result.scores
        });

        // Create visualization
        const vizCanvas = createCanvas(image.width, image.height + 80);
        const vizCtx = vizCanvas.getContext('2d');
        vizCtx.drawImage(image, 0, 0);

        // Draw sampled regions
        vizCtx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        vizCtx.lineWidth = 2;
        vizCtx.strokeRect(image.width * 0.3, image.height * 0.25, image.width * 0.4, image.height * 0.3);
        vizCtx.strokeRect(image.width * 0.2, image.height * 0.4, image.width * 0.2, image.height * 0.2);
        vizCtx.strokeRect(image.width * 0.6, image.height * 0.4, image.width * 0.2, image.height * 0.2);

        // Info panel
        vizCtx.fillStyle = '#1a1a2e';
        vizCtx.fillRect(0, image.height, image.width, 80);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '12px monospace';

        vizCtx.fillText(`Detected: ${result.detected} (${(result.confidence * 100).toFixed(0)}%)`, 10, image.height + 20);
        vizCtx.fillText(`Actual: ${actualBiome} | Match: ${isCorrect ? 'YES' : 'NO'}`, 10, image.height + 40);
        vizCtx.fillText(`Avg RGB: (${Math.round(result.avgColor.r)}, ${Math.round(result.avgColor.g)}, ${Math.round(result.avgColor.b)})`, 10, image.height + 60);

        // Color swatch
        vizCtx.fillStyle = `rgb(${Math.round(result.avgColor.r)}, ${Math.round(result.avgColor.g)}, ${Math.round(result.avgColor.b)})`;
        vizCtx.fillRect(image.width - 60, image.height + 10, 50, 50);

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `biome_${filename.replace(/[\/\.]/g, '_')}.png`),
            vizCanvas.toBuffer('image/png')
        );
    }

    console.log('|-------|--------|----------|------------|-------|');
    console.log(`\nAccuracy: ${correct}/${total} (${(correct / total * 100).toFixed(1)}%)`);

    // Save results
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'results.json'),
        JSON.stringify(results, null, 2)
    );

    console.log(`\nVisualizations saved to: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
