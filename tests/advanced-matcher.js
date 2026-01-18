#!/usr/bin/env node
// Advanced Item Matcher with adaptive thresholds and biome normalization

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const V1_DIR = './test-results/extracted-templates';
const OUTPUT_DIR = './test-results/advanced-matching';

// Per-item threshold calibration based on measured performance
// Items that match well get lower thresholds, noisy items get higher
const ITEM_THRESHOLDS = {
    // High confidence items (low false positive rate)
    'borgar': { ncc: 0.58, minVariance: 400 },
    'oats': { ncc: 0.60, minVariance: 400 },
    'feathers': { ncc: 0.55, minVariance: 350 },
    'wrench': { ncc: 0.58, minVariance: 400 },
    'beer': { ncc: 0.58, minVariance: 400 },
    'ghost': { ncc: 0.55, minVariance: 350 },
    'backpack': { ncc: 0.58, minVariance: 400 },
    // Default for unknown items
    'default': { ncc: 0.60, minVariance: 400 }
};

// Biome color profiles for normalization
const BIOME_PROFILES = {
    forest: { avgR: 80, avgG: 70, avgB: 120, tint: 'purple' },
    desert: { avgR: 105, avgG: 115, avgB: 135, tint: 'neutral' },
    snow: { avgR: 120, avgG: 130, avgB: 145, tint: 'blue' },
    hell: { avgR: 120, avgG: 60, avgB: 50, tint: 'red' },
    ocean: { avgR: 35, avgG: 125, avgB: 155, tint: 'blue' },
    crypt: { avgR: 105, avgG: 88, avgB: 110, tint: 'purple' },
    unknown: { avgR: 100, avgG: 100, avgB: 100, tint: 'neutral' }
};

// ==================== BIOME DETECTION ====================
function detectBiome(ctx, width, height) {
    const regions = [
        { x: width * 0.3, y: height * 0.25, w: width * 0.4, h: height * 0.3 },
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

    // Simple biome classification
    if (avg.r > 100 && avg.g < 70) return 'hell';
    if (avg.b > 130 && avg.g > 100) return 'ocean';
    if (avg.r > 110 && avg.g > 120) return 'snow';
    if (avg.b > 100 && avg.r < 90) return 'forest';
    if (avg.r > 80 && avg.g > 60 && avg.b > 80 && avg.b < 130) return 'crypt';
    return 'desert';
}

// ==================== COLOR NORMALIZATION ====================
function normalizeForBiome(imageData, biome) {
    const profile = BIOME_PROFILES[biome] || BIOME_PROFILES.unknown;
    const data = imageData.data;
    const normalized = new Uint8ClampedArray(data.length);

    // Calculate average color of the cell
    let cellR = 0, cellG = 0, cellB = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
        cellR += data[i]; cellG += data[i+1]; cellB += data[i+2];
        count++;
    }
    cellR /= count; cellG /= count; cellB /= count;

    // Normalize to reduce biome tint effect
    const targetR = 128, targetG = 128, targetB = 128;

    for (let i = 0; i < data.length; i += 4) {
        // Shift towards neutral while preserving relative differences
        const shiftR = (targetR - profile.avgR) * 0.3;
        const shiftG = (targetG - profile.avgG) * 0.3;
        const shiftB = (targetB - profile.avgB) * 0.3;

        normalized[i] = Math.max(0, Math.min(255, data[i] + shiftR));
        normalized[i+1] = Math.max(0, Math.min(255, data[i+1] + shiftG));
        normalized[i+2] = Math.max(0, Math.min(255, data[i+2] + shiftB));
        normalized[i+3] = data[i+3];
    }

    return new ImageData(normalized, imageData.width, imageData.height);
}

// ==================== MATCHING FUNCTIONS ====================
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

function calculateHistogramSimilarity(d1, d2) {
    const hist1 = new Array(32).fill(0);
    const hist2 = new Array(32).fill(0);

    for (let i = 0; i < d1.data.length; i += 4) {
        const g1 = Math.floor((d1.data[i] + d1.data[i+1] + d1.data[i+2]) / 3 / 8);
        const g2 = Math.floor((d2.data[i] + d2.data[i+1] + d2.data[i+2]) / 3 / 8);
        hist1[g1]++;
        hist2[g2]++;
    }

    // Normalize
    const total = d1.data.length / 4;
    for (let i = 0; i < 32; i++) {
        hist1[i] /= total;
        hist2[i] /= total;
    }

    // Bhattacharyya coefficient
    let bc = 0;
    for (let i = 0; i < 32; i++) {
        bc += Math.sqrt(hist1[i] * hist2[i]);
    }

    return bc;
}

function calculateEdgeSimilarity(d1, d2) {
    const w = Math.sqrt(d1.data.length / 4);
    const h = w;

    function getEdges(data) {
        const gray = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
            gray[i] = (data.data[i*4] + data.data[i*4+1] + data.data[i*4+2]) / 3;
        }

        const edges = new Float32Array(w * h);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const gx = Math.abs(gray[y*w + x+1] - gray[y*w + x-1]);
                const gy = Math.abs(gray[(y+1)*w + x] - gray[(y-1)*w + x]);
                edges[y*w + x] = Math.sqrt(gx*gx + gy*gy);
            }
        }
        return edges;
    }

    const e1 = getEdges(d1);
    const e2 = getEdges(d2);

    // Correlation of edge maps
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0, c = 0;
    for (let i = 0; i < e1.length; i++) {
        s1 += e1[i]; s2 += e2[i]; sp += e1[i]*e2[i];
        ss1 += e1[i]*e1[i]; ss2 += e2[i]*e2[i]; c++;
    }
    const m1 = s1/c, m2 = s2/c;
    const num = sp/c - m1*m2;
    const den = Math.sqrt((ss1/c - m1*m1) * (ss2/c - m2*m2));

    return den === 0 ? 0 : (num/den + 1) / 2;
}

// Combined matching score
function calculateCombinedScore(cell, template, biome) {
    // Normalize cell for biome
    const normalizedCell = normalizeForBiome(cell, biome);

    const ncc = calculateNCC(normalizedCell, template);
    const hist = calculateHistogramSimilarity(normalizedCell, template);
    const edge = calculateEdgeSimilarity(normalizedCell, template);

    // Weighted combination
    return {
        ncc,
        histogram: hist,
        edge,
        combined: ncc * 0.5 + hist * 0.25 + edge * 0.25
    };
}

// ==================== GRID DETECTION ====================
function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(34 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(42 * scale);
    const rowHeight = Math.round(40 * scale);
    const positions = [];

    for (let row = 0; row < 3; row++) {
        const y = height - bottomMargin - (row * rowHeight) - iconSize;
        if (y < height * 0.65) continue;

        const sideMargin = Math.round(width * 0.15);
        const cellWidth = iconSize + spacing;
        const maxItemsPerRow = Math.min(22, Math.floor((width - sideMargin * 2) / cellWidth));
        const totalWidth = maxItemsPerRow * cellWidth;
        const startX = Math.round((width - totalWidth) / 2);

        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * cellWidth, y, width: iconSize, height: iconSize, row, col: i });
        }
    }
    return positions;
}

function normalizeItemId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ==================== MAIN ====================
async function loadTemplates() {
    const templates = new Map();
    if (!fs.existsSync(V1_DIR)) return templates;

    const files = fs.readdirSync(V1_DIR).filter(f => f.endsWith('.png'));
    for (const file of files) {
        const itemId = file.replace('.png', '');
        try {
            const img = await loadImage(path.join(V1_DIR, file));
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            templates.set(itemId, { name: itemId, imageData: ctx.getImageData(0, 0, 32, 32) });
        } catch {}
    }
    return templates;
}

async function main() {
    console.log('=== Advanced Item Matcher ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const templates = await loadTemplates();
    console.log(`Loaded ${templates.size} templates: ${[...templates.keys()].join(', ')}\n`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    let totalTP = 0, totalFP = 0, totalFN = 0;

    console.log('| Image | Biome | TP | FP | FN | Best Matches |');
    console.log('|-------|-------|----|----|-----|--------------|');

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        // Detect biome for normalization
        const biome = detectBiome(ctx, image.width, image.height);

        const positions = detectGridPositions(image.width, image.height);
        const expectedItems = (data.items || []).map(normalizeItemId);

        const expectedCounts = new Map();
        for (const item of expectedItems) {
            expectedCounts.set(item, (expectedCounts.get(item) || 0) + 1);
        }

        const detectedCounts = new Map();
        const bestMatches = [];

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);

            // Check if empty
            let sum = 0, sumSq = 0, count = 0;
            for (let i = 0; i < cellData.data.length; i += 4) {
                const gray = (cellData.data[i] + cellData.data[i+1] + cellData.data[i+2]) / 3;
                sum += gray; sumSq += gray * gray; count++;
            }
            const variance = sumSq / count - (sum / count) ** 2;
            if (variance < 350) continue;

            // Resize to 32x32
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.1);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            // Match against all templates with combined scoring
            let bestMatch = null, bestScore = 0, bestScores = null;

            for (const [itemId, template] of templates) {
                const scores = calculateCombinedScore(resizedCell, template.imageData, biome);

                // Use per-item threshold
                const threshold = ITEM_THRESHOLDS[itemId]?.ncc || ITEM_THRESHOLDS.default.ncc;

                if (scores.ncc >= threshold && scores.combined > bestScore) {
                    bestScore = scores.combined;
                    bestMatch = itemId;
                    bestScores = scores;
                }
            }

            if (bestMatch) {
                detectedCounts.set(bestMatch, (detectedCounts.get(bestMatch) || 0) + 1);
                bestMatches.push({ item: bestMatch, score: bestScores.ncc, combined: bestScores.combined });
            }
        }

        // Calculate TP/FP/FN
        let tp = 0, fp = 0, fn = 0;
        for (const [item, expected] of expectedCounts) {
            const detected = detectedCounts.get(item) || 0;
            tp += Math.min(expected, detected);
            fn += Math.max(0, expected - detected);
        }
        for (const [item, detected] of detectedCounts) {
            const expected = expectedCounts.get(item) || 0;
            fp += Math.max(0, detected - expected);
        }

        totalTP += tp;
        totalFP += fp;
        totalFN += fn;

        const topMatches = bestMatches
            .sort((a, b) => b.combined - a.combined)
            .slice(0, 3)
            .map(m => `${m.item}:${(m.score*100).toFixed(0)}`)
            .join(' ');

        console.log(`| ${filename.slice(9, 28).padEnd(19)} | ${biome.padEnd(6)} | ${String(tp).padStart(2)} | ${String(fp).padStart(2)} | ${String(fn).padStart(3)} | ${topMatches} |`);
    }

    console.log('|-------|-------|----|----|-----|--------------|');

    const precision = totalTP / (totalTP + totalFP) || 0;
    const recall = totalTP / (totalTP + totalFN) || 0;
    const f1 = 2 * precision * recall / (precision + recall) || 0;

    console.log(`\n=== Results ===`);
    console.log(`TP: ${totalTP}, FP: ${totalFP}, FN: ${totalFN}`);
    console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
    console.log(`Recall: ${(recall * 100).toFixed(1)}%`);
    console.log(`F1 Score: ${(f1 * 100).toFixed(1)}%`);

    // Compare to baseline
    console.log(`\nBaseline (V1 simple): 21.6% F1`);
    const improvement = f1 * 100 - 21.6;
    console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
}

main().catch(console.error);
