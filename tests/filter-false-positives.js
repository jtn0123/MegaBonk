#!/usr/bin/env node
// Filter false positives using cluster analysis and improved heuristics

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';

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

function analyzeCell(imageData) {
    const w = imageData.width, h = imageData.height;
    let sum = 0, sumSq = 0, count = 0;
    let edgeCount = 0;

    // Full image variance
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;

    // Center region variance (exclude edges)
    const margin = Math.round(w * 0.2);
    let centerSum = 0, centerSumSq = 0, centerCount = 0;
    for (let y = margin; y < h - margin; y++) {
        for (let x = margin; x < w - margin; x++) {
            const i = (y * w + x) * 4;
            const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
            centerSum += gray; centerSumSq += gray * gray; centerCount++;
        }
    }
    const centerMean = centerCount > 0 ? centerSum / centerCount : 0;
    const centerVariance = centerCount > 0 ? centerSumSq / centerCount - centerMean * centerMean : 0;

    // Edge content (is content concentrated at edges?)
    let edgeContent = 0, centerContent = 0;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = Math.abs(gray[y*w + x+1] - gray[y*w + x-1]);
            const gy = Math.abs(gray[(y+1)*w + x] - gray[(y-1)*w + x]);
            const edgeMag = gx + gy;

            if (x < margin || x >= w - margin || y < margin || y >= h - margin) {
                edgeContent += edgeMag;
            } else {
                centerContent += edgeMag;
            }

            if (edgeMag > 30) edgeCount++;
        }
    }

    const edgeRatio = edgeContent > 0 && centerContent > 0 ?
        edgeContent / (edgeContent + centerContent) : 0;

    return {
        variance,
        mean,
        centerVariance,
        centerMean,
        edgeRatio,
        edgeDensity: edgeCount / ((w-2) * (h-2))
    };
}

function isLikelyFalsePositive(stats) {
    // False positives typically:
    // 1. Have content only at edges (partial item captures)
    // 2. Low center variance (mostly uniform background)
    // 3. Very dark (mean < 40)

    if (stats.centerVariance < 200 && stats.variance > 300) {
        // High edge variance but low center = edge crop
        return true;
    }

    if (stats.edgeRatio > 0.7) {
        // Most content is at edges
        return true;
    }

    if (stats.mean < 35 && stats.variance < 400) {
        // Very dark with low variance = background
        return true;
    }

    if (stats.centerMean < 30) {
        // Dark center
        return true;
    }

    return false;
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
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
    const templates = new Map();

    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join('./src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(32, 32);
            const ctx = canvas.getContext('2d');
            const margin = Math.round(img.width * 0.1);
            ctx.drawImage(img, margin, margin, img.width - margin*2, img.height - margin*2, 0, 0, 32, 32);
            templates.set(item.id, ctx.getImageData(0, 0, 32, 32));
        } catch {}
    }

    return templates;
}

async function test(filterEnabled) {
    const templates = await loadTemplates();
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    let totalTP = 0, totalFP = 0, totalFN = 0;
    let totalCells = 0, filteredCells = 0;

    for (const [filename, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', filename);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        const truth = new Map();
        data.items.forEach(item => {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            truth.set(id, (truth.get(id) || 0) + 1);
        });

        const detections = new Map();

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            const stats = analyzeCell(cellData);

            // Basic empty check
            if (stats.variance < 350 || stats.mean < 30) continue;
            totalCells++;

            // Additional false positive filtering
            if (filterEnabled && isLikelyFalsePositive(stats)) {
                filteredCells++;
                continue;
            }

            // Resize and match
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin,
                pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedCell = resizeCtx.getImageData(0, 0, 32, 32);

            let bestMatch = null;
            let bestScore = 0;

            for (const [itemId, templateData] of templates) {
                const score = calculateNCC(resizedCell, templateData);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = itemId;
                }
            }

            if (bestMatch && bestScore >= 0.45) {
                detections.set(bestMatch, (detections.get(bestMatch) || 0) + 1);
            }
        }

        let tp = 0, fp = 0, fn = 0;
        detections.forEach((count, id) => {
            const expected = truth.get(id) || 0;
            tp += Math.min(count, expected);
            if (count > expected) fp += count - expected;
        });
        truth.forEach((count, id) => {
            const detected = detections.get(id) || 0;
            if (detected < count) fn += count - detected;
        });

        totalTP += tp;
        totalFP += fp;
        totalFN += fn;
    }

    const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
    const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

    return {
        precision, recall, f1,
        tp: totalTP, fp: totalFP, fn: totalFN,
        totalCells, filteredCells
    };
}

async function main() {
    console.log('=== False Positive Filtering Test ===\n');

    console.log('Testing without filtering...');
    const withoutFilter = await test(false);

    console.log('Testing with filtering...');
    const withFilter = await test(true);

    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log('| Configuration     | Precision | Recall  | F1 Score | Cells |');
    console.log('|-------------------|-----------|---------|----------|-------|');

    console.log(`| Without filter    | ${(withoutFilter.precision*100).toFixed(1).padStart(8)}% | ${(withoutFilter.recall*100).toFixed(1).padStart(6)}% | ${(withoutFilter.f1*100).toFixed(1).padStart(7)}% | ${withoutFilter.totalCells} |`);
    console.log(`| With filter       | ${(withFilter.precision*100).toFixed(1).padStart(8)}% | ${(withFilter.recall*100).toFixed(1).padStart(6)}% | ${(withFilter.f1*100).toFixed(1).padStart(7)}% | ${withFilter.totalCells - withFilter.filteredCells} |`);

    const improvement = ((withFilter.f1 - withoutFilter.f1) / withoutFilter.f1 * 100);
    console.log(`\nFiltered ${withFilter.filteredCells} likely false positives`);
    console.log(`F1 change: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);
}

main().catch(console.error);
