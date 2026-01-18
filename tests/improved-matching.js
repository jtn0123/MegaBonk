#!/usr/bin/env node
// Improved template matching using edge detection and SSIM

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';

// Calibrated grid detection
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

function isEmptyCell(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
        sum += gray; sumSq += gray * gray; count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return variance < 350 || mean < 30;
}

// Sobel edge detection
function extractEdges(imageData) {
    const w = imageData.width, h = imageData.height;
    const gray = new Float32Array(w * h);
    const edges = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = gray[(y-1)*w + x+1] - gray[(y-1)*w + x-1] +
                      2*gray[y*w + x+1] - 2*gray[y*w + x-1] +
                      gray[(y+1)*w + x+1] - gray[(y+1)*w + x-1];
            const gy = gray[(y+1)*w + x-1] - gray[(y-1)*w + x-1] +
                      2*gray[(y+1)*w + x] - 2*gray[(y-1)*w + x] +
                      gray[(y+1)*w + x+1] - gray[(y-1)*w + x+1];
            edges[y * w + x] = Math.min(255, Math.sqrt(gx*gx + gy*gy));
        }
    }
    return edges;
}

// NCC for edge maps
function edgeNCC(e1, e2) {
    const len = Math.min(e1.length, e2.length);
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0;
    for (let i = 0; i < len; i++) {
        s1 += e1[i]; s2 += e2[i];
        sp += e1[i] * e2[i];
        ss1 += e1[i] * e1[i];
        ss2 += e2[i] * e2[i];
    }
    const m1 = s1/len, m2 = s2/len;
    const num = sp/len - m1*m2;
    const den = Math.sqrt((ss1/len - m1*m1) * (ss2/len - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

// SSIM (Structural Similarity Index)
function calculateSSIM(d1, d2) {
    const len = Math.min(d1.data.length, d2.data.length) / 4;
    const C1 = 6.5025, C2 = 58.5225; // (0.01*255)^2, (0.03*255)^2

    let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;

    for (let i = 0; i < len; i++) {
        const x = (d1.data[i*4] + d1.data[i*4+1] + d1.data[i*4+2]) / 3;
        const y = (d2.data[i*4] + d2.data[i*4+1] + d2.data[i*4+2]) / 3;
        sumX += x; sumY += y;
        sumXX += x*x; sumYY += y*y;
        sumXY += x*y;
    }

    const muX = sumX / len;
    const muY = sumY / len;
    const sigmaXX = sumXX / len - muX * muX;
    const sigmaYY = sumYY / len - muY * muY;
    const sigmaXY = sumXY / len - muX * muY;

    const ssim = ((2*muX*muY + C1) * (2*sigmaXY + C2)) /
                 ((muX*muX + muY*muY + C1) * (sigmaXX + sigmaYY + C2));

    return (ssim + 1) / 2; // Normalize to 0-1
}

// Gradient histogram comparison
function gradientHistogram(imageData, bins = 8) {
    const w = imageData.width, h = imageData.height;
    const gray = new Float32Array(w * h);
    const hist = new Float32Array(bins);

    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    let total = 0;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = gray[y*w + x+1] - gray[y*w + x-1];
            const gy = gray[(y+1)*w + x] - gray[(y-1)*w + x];
            const mag = Math.sqrt(gx*gx + gy*gy);
            if (mag > 10) { // Threshold for significant gradient
                let angle = Math.atan2(gy, gx);
                if (angle < 0) angle += Math.PI * 2;
                const bin = Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins));
                hist[bin] += mag;
                total += mag;
            }
        }
    }

    // Normalize
    if (total > 0) {
        for (let i = 0; i < bins; i++) hist[i] /= total;
    }
    return hist;
}

function histogramIntersection(h1, h2) {
    let intersection = 0;
    for (let i = 0; i < h1.length; i++) {
        intersection += Math.min(h1[i], h2[i]);
    }
    return intersection;
}

// Resize and extract center
function preprocessCell(ctx, x, y, w, h, targetSize) {
    const margin = Math.round(w * 0.15);
    const srcCanvas = createCanvas(w, h);
    const srcCtx = srcCanvas.getContext('2d');
    const cellData = ctx.getImageData(x, y, w, h);
    srcCtx.putImageData(cellData, 0, 0);

    const dstCanvas = createCanvas(targetSize, targetSize);
    const dstCtx = dstCanvas.getContext('2d');
    dstCtx.drawImage(srcCanvas, margin, margin, w - margin*2, h - margin*2,
                     0, 0, targetSize, targetSize);
    return dstCtx.getImageData(0, 0, targetSize, targetSize);
}

function preprocessTemplate(template, targetSize) {
    const margin = Math.round(template.width * 0.1);
    const dstCanvas = createCanvas(targetSize, targetSize);
    const dstCtx = dstCanvas.getContext('2d');
    dstCtx.drawImage(template.canvas, margin, margin,
                     template.width - margin*2, template.height - margin*2,
                     0, 0, targetSize, targetSize);
    return dstCtx.getImageData(0, 0, targetSize, targetSize);
}

async function runComparison() {
    console.log('=== Improved Matching Comparison ===\n');

    // Load templates
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
    const templates = new Map();

    for (const item of itemsData.items) {
        if (!item.image) continue;
        const imagePath = path.join('./src/', item.image);
        if (!fs.existsSync(imagePath)) continue;

        try {
            const img = await loadImage(imagePath);
            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            templates.set(item.id, { item, canvas, width: img.width, height: img.height });
        } catch {}
    }

    console.log(`Loaded ${templates.size} templates`);

    // Pre-process templates
    const TARGET_SIZE = 32;
    const processedTemplates = new Map();

    for (const [id, template] of templates) {
        const imageData = preprocessTemplate(template, TARGET_SIZE);
        processedTemplates.set(id, {
            item: template.item,
            imageData,
            edges: extractEdges(imageData),
            gradHist: gradientHistogram(imageData)
        });
    }

    console.log(`Preprocessed ${processedTemplates.size} templates\n`);

    // Load ground truth
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Test different matching strategies
    const strategies = [
        { name: 'Edge NCC only', weights: { edge: 1, ssim: 0, grad: 0 } },
        { name: 'SSIM only', weights: { edge: 0, ssim: 1, grad: 0 } },
        { name: 'Edge + SSIM', weights: { edge: 0.5, ssim: 0.5, grad: 0 } },
        { name: 'Edge + Grad', weights: { edge: 0.6, ssim: 0, grad: 0.4 } },
        { name: 'All three', weights: { edge: 0.4, ssim: 0.4, grad: 0.2 } },
        { name: 'Edge-heavy', weights: { edge: 0.7, ssim: 0.2, grad: 0.1 } }
    ];

    const results = strategies.map(s => ({ ...s, tp: 0, fp: 0, fn: 0 }));

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        // Build ground truth map
        const truth = new Map();
        data.items.forEach(item => {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            truth.set(id, (truth.get(id) || 0) + 1);
        });

        // Process each cell
        const cellFeatures = [];
        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            if (isEmptyCell(cellData)) continue;

            const processed = preprocessCell(ctx, pos.x, pos.y, pos.width, pos.height, TARGET_SIZE);
            cellFeatures.push({
                imageData: processed,
                edges: extractEdges(processed),
                gradHist: gradientHistogram(processed)
            });
        }

        // Test each strategy
        for (let si = 0; si < strategies.length; si++) {
            const strategy = strategies[si];
            const detections = new Map();

            for (const cell of cellFeatures) {
                let bestMatch = null;
                let bestScore = 0;

                for (const [id, template] of processedTemplates) {
                    const edgeScore = edgeNCC(cell.edges, template.edges);
                    const ssimScore = calculateSSIM(cell.imageData, template.imageData);
                    const gradScore = histogramIntersection(cell.gradHist, template.gradHist);

                    const combined = edgeScore * strategy.weights.edge +
                                    ssimScore * strategy.weights.ssim +
                                    gradScore * strategy.weights.grad;

                    if (combined > bestScore) {
                        bestScore = combined;
                        bestMatch = id;
                    }
                }

                if (bestMatch && bestScore >= 0.45) {
                    detections.set(bestMatch, (detections.get(bestMatch) || 0) + 1);
                }
            }

            // Calculate metrics
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

            results[si].tp += tp;
            results[si].fp += fp;
            results[si].fn += fn;
        }
    }

    // Report results
    console.log('Strategy Comparison:');
    console.log('=' .repeat(70));
    console.log('| Strategy             | Precision | Recall  | F1 Score |');
    console.log('|----------------------|-----------|---------|----------|');

    let bestF1 = 0;
    let bestStrategy = null;

    for (const r of results) {
        const precision = r.tp + r.fp > 0 ? r.tp / (r.tp + r.fp) : 0;
        const recall = r.tp + r.fn > 0 ? r.tp / (r.tp + r.fn) : 0;
        const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

        console.log(`| ${r.name.padEnd(20)} | ${(precision*100).toFixed(1).padStart(8)}% | ${(recall*100).toFixed(1).padStart(6)}% | ${(f1*100).toFixed(1).padStart(7)}% |`);

        if (f1 > bestF1) {
            bestF1 = f1;
            bestStrategy = r.name;
        }
    }

    console.log('|----------------------|-----------|---------|----------|');
    console.log(`\nBest strategy: ${bestStrategy} with F1=${(bestF1*100).toFixed(1)}%`);

    // Compare with baseline
    console.log('\nCompared to baseline template matching (NCC only): 6.4% F1');
    const improvement = ((bestF1 - 0.064) / 0.064 * 100);
    console.log(`Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);
}

runComparison().catch(console.error);
