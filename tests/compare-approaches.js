#!/usr/bin/env node
// Compare CNN-based matching vs template matching on real screenshots

const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const canvas = require('canvas');
const { createCanvas, loadImage, ImageData } = canvas;
globalThis.ImageData = ImageData;

const CROP_SIZE = 48;
const GT_PATH = './test-images/gameplay/ground-truth.json';

// Grid detection (matches CV runner)
function detectGridPositions(width, height) {
    const scale = height / 720;
    const iconSize = Math.round(40 * scale);
    const spacing = Math.round(4 * scale);
    const bottomMargin = Math.round(20 * scale);
    const positions = [];
    const rowHeight = iconSize + spacing;

    const rowYPositions = [
        height - bottomMargin - iconSize,
        height - bottomMargin - iconSize - rowHeight,
        height - bottomMargin - iconSize - rowHeight * 2,
    ];

    const sideMargin = Math.round(width * 0.20);
    const usableWidth = width - sideMargin * 2;
    const maxItemsPerRow = Math.min(20, Math.floor(usableWidth / (iconSize + spacing)));

    for (const rowY of rowYPositions) {
        if (rowY < height * 0.75) break;
        const totalWidth = maxItemsPerRow * (iconSize + spacing);
        const startX = Math.round((width - totalWidth) / 2);
        for (let i = 0; i < maxItemsPerRow; i++) {
            positions.push({ x: startX + i * (iconSize + spacing), y: rowY, width: iconSize, height: iconSize });
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
    return variance < 300 || mean < 40;
}

// Template matching functions
function enhanceContrast(imageData, factor = 1.5) {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, 128 + (data[i] - 128) * factor));
        data[i+1] = Math.min(255, Math.max(0, 128 + (data[i+1] - 128) * factor));
        data[i+2] = Math.min(255, Math.max(0, 128 + (data[i+2] - 128) * factor));
    }
    return { data, width: imageData.width, height: imageData.height };
}

function normalizeColors(imageData) {
    const data = new Uint8ClampedArray(imageData.data);
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]); maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i+1]); maxG = Math.max(maxG, data[i+1]);
        minB = Math.min(minB, data[i+2]); maxB = Math.max(maxB, data[i+2]);
    }
    const rR = maxR - minR || 1, rG = maxG - minG || 1, rB = maxB - minB || 1;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round((data[i] - minR) / rR * 255);
        data[i+1] = Math.round((data[i+1] - minG) / rG * 255);
        data[i+2] = Math.round((data[i+2] - minB) / rB * 255);
    }
    return { data, width: imageData.width, height: imageData.height };
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

// Load image as tensor for CNN
function imageDataToTensor(imageData, targetSize) {
    const canvas = createCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d');

    const srcCanvas = createCanvas(imageData.width, imageData.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    ), 0, 0);

    ctx.drawImage(srcCanvas, 0, 0, imageData.width, imageData.height, 0, 0, targetSize, targetSize);
    const resizedData = ctx.getImageData(0, 0, targetSize, targetSize);

    const data = new Float32Array(targetSize * targetSize * 3);
    for (let i = 0; i < targetSize * targetSize; i++) {
        data[i * 3] = resizedData.data[i * 4] / 255;
        data[i * 3 + 1] = resizedData.data[i * 4 + 1] / 255;
        data[i * 3 + 2] = resizedData.data[i * 4 + 2] / 255;
    }
    return tf.tensor3d(data, [targetSize, targetSize, 3]);
}

async function compare() {
    console.log('=== Approach Comparison: CNN vs Template Matching ===\n');

    // Load ground truth
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    // Load templates for both approaches
    const itemsData = JSON.parse(fs.readFileSync('./data/items.json', 'utf-8'));
    const templates = new Map();
    const templateTensors = new Map();

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

            // Also create tensor for CNN
            const tensorCanvas = createCanvas(CROP_SIZE, CROP_SIZE);
            const tensorCtx = tensorCanvas.getContext('2d');
            const margin = Math.round(img.width * 0.1);
            tensorCtx.drawImage(img, margin, margin, img.width - margin*2, img.height - margin*2, 0, 0, CROP_SIZE, CROP_SIZE);
            const tensorData = tensorCtx.getImageData(0, 0, CROP_SIZE, CROP_SIZE);

            const data = new Float32Array(CROP_SIZE * CROP_SIZE * 3);
            for (let i = 0; i < CROP_SIZE * CROP_SIZE; i++) {
                data[i * 3] = tensorData.data[i * 4] / 255;
                data[i * 3 + 1] = tensorData.data[i * 4 + 1] / 255;
                data[i * 3 + 2] = tensorData.data[i * 4 + 2] / 255;
            }
            templateTensors.set(item.id, tf.tensor3d(data, [CROP_SIZE, CROP_SIZE, 3]));
        } catch {}
    }

    console.log(`Loaded ${templates.size} templates\n`);

    // Load CNN model
    let cnnModel = null;
    let cnnEmbeddings = new Map();
    const modelPath = './training-data/model/model.json';

    if (fs.existsSync(modelPath)) {
        cnnModel = await tf.loadLayersModel(`file://${modelPath}`);
        console.log('Loaded CNN embedding model');

        // Pre-compute template embeddings
        for (const [itemId, tensor] of templateTensors) {
            const embedding = cnnModel.predict(tensor.expandDims(0));
            cnnEmbeddings.set(itemId, embedding);
        }
        console.log(`Computed ${cnnEmbeddings.size} CNN embeddings\n`);
    } else {
        console.log('No CNN model found, skipping CNN comparison\n');
    }

    // Results tracking
    const results = {
        template: { tp: 0, fp: 0, fn: 0, time: 0 },
        cnn: { tp: 0, fp: 0, fn: 0, time: 0 }
    };

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        console.log(`Testing: ${name.slice(9, 40)}`);

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const gridPositions = detectGridPositions(image.width, image.height);
        const nonEmptyCells = [];

        for (const cell of gridPositions) {
            const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
            if (!isEmptyCell(cellData)) {
                nonEmptyCells.push({ ...cell, imageData: cellData });
            }
        }

        // Ground truth
        const truth = new Map();
        data.items.forEach(item => {
            const id = item.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            truth.set(id, (truth.get(id) || 0) + 1);
        });

        // === Template Matching ===
        const templateStart = Date.now();
        const templateDetections = new Map();

        for (const cell of nonEmptyCells) {
            const margin = Math.round(cell.width * 0.15);
            const cw = cell.width - margin * 2, ch = cell.height - margin * 2;
            if (cw <= 0 || ch <= 0) continue;

            const centerData = { data: new Uint8ClampedArray(cw * ch * 4), width: cw, height: ch };
            for (let y = 0; y < ch; y++) {
                for (let x = 0; x < cw; x++) {
                    const src = ((y + margin) * cell.width + (x + margin)) * 4;
                    const dst = (y * cw + x) * 4;
                    centerData.data[dst] = cell.imageData.data[src];
                    centerData.data[dst+1] = cell.imageData.data[src+1];
                    centerData.data[dst+2] = cell.imageData.data[src+2];
                    centerData.data[dst+3] = cell.imageData.data[src+3];
                }
            }

            let processed = enhanceContrast(centerData);
            processed = normalizeColors(processed);

            let bestMatch = null;
            for (const [itemId, template] of templates) {
                const tMargin = Math.round(template.width * 0.15);
                const tempCanvas = createCanvas(cw, ch);
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(template.canvas, tMargin, tMargin,
                    template.width - tMargin*2, template.height - tMargin*2, 0, 0, cw, ch);
                let templateData = tempCtx.getImageData(0, 0, cw, ch);
                templateData = enhanceContrast(templateData);
                templateData = normalizeColors(templateData);

                const similarity = calculateNCC(processed, templateData);
                if (!bestMatch || similarity > bestMatch.confidence) {
                    bestMatch = { id: itemId, confidence: similarity };
                }
            }

            if (bestMatch && bestMatch.confidence >= 0.45) {
                templateDetections.set(bestMatch.id, (templateDetections.get(bestMatch.id) || 0) + 1);
            }
        }

        results.template.time += Date.now() - templateStart;

        // Calculate template F1
        let tTP = 0, tFP = 0, tFN = 0;
        templateDetections.forEach((c, id) => { const t = truth.get(id) || 0; tTP += Math.min(c, t); if (c > t) tFP += c - t; });
        truth.forEach((c, id) => { const d = templateDetections.get(id) || 0; if (d < c) tFN += c - d; });
        results.template.tp += tTP;
        results.template.fp += tFP;
        results.template.fn += tFN;

        // === CNN Matching ===
        if (cnnModel) {
            const cnnStart = Date.now();
            const cnnDetections = new Map();

            for (const cell of nonEmptyCells) {
                const cellTensor = imageDataToTensor(cell.imageData, CROP_SIZE);
                const cellEmbedding = cnnModel.predict(cellTensor.expandDims(0));

                let bestMatch = null;
                for (const [itemId, templateEmb] of cnnEmbeddings) {
                    const similarity = tf.tidy(() => {
                        const dot = cellEmbedding.mul(templateEmb).sum();
                        const norm1 = cellEmbedding.norm();
                        const norm2 = templateEmb.norm();
                        return dot.div(norm1.mul(norm2)).dataSync()[0];
                    });

                    if (!bestMatch || similarity > bestMatch.confidence) {
                        bestMatch = { id: itemId, confidence: similarity };
                    }
                }

                if (bestMatch && bestMatch.confidence >= 0.5) {
                    cnnDetections.set(bestMatch.id, (cnnDetections.get(bestMatch.id) || 0) + 1);
                }

                cellTensor.dispose();
                cellEmbedding.dispose();
            }

            results.cnn.time += Date.now() - cnnStart;

            // Calculate CNN F1
            let cTP = 0, cFP = 0, cFN = 0;
            cnnDetections.forEach((c, id) => { const t = truth.get(id) || 0; cTP += Math.min(c, t); if (c > t) cFP += c - t; });
            truth.forEach((c, id) => { const d = cnnDetections.get(id) || 0; if (d < c) cFN += c - d; });
            results.cnn.tp += cTP;
            results.cnn.fp += cFP;
            results.cnn.fn += cFN;

            const tF1 = tTP + tFP + tFN > 0 ? 2*tTP / (2*tTP + tFP + tFN) : 0;
            const cF1 = cTP + cFP + cFN > 0 ? 2*cTP / (2*cTP + cFP + cFN) : 0;
            console.log(`  Template: F1=${(tF1*100).toFixed(1)}% | CNN: F1=${(cF1*100).toFixed(1)}%`);
        }
    }

    // Overall results
    console.log('\n' + '='.repeat(60));
    console.log('OVERALL RESULTS');
    console.log('='.repeat(60));

    const tP = results.template.tp + results.template.fp > 0 ? results.template.tp / (results.template.tp + results.template.fp) : 0;
    const tR = results.template.tp + results.template.fn > 0 ? results.template.tp / (results.template.tp + results.template.fn) : 0;
    const tF1 = tP + tR > 0 ? 2 * tP * tR / (tP + tR) : 0;

    console.log('\nTemplate Matching:');
    console.log(`  Precision: ${(tP*100).toFixed(1)}%`);
    console.log(`  Recall:    ${(tR*100).toFixed(1)}%`);
    console.log(`  F1 Score:  ${(tF1*100).toFixed(1)}%`);
    console.log(`  Time:      ${results.template.time}ms`);

    if (cnnModel) {
        const cP = results.cnn.tp + results.cnn.fp > 0 ? results.cnn.tp / (results.cnn.tp + results.cnn.fp) : 0;
        const cR = results.cnn.tp + results.cnn.fn > 0 ? results.cnn.tp / (results.cnn.tp + results.cnn.fn) : 0;
        const cF1 = cP + cR > 0 ? 2 * cP * cR / (cP + cR) : 0;

        console.log('\nCNN Embedding:');
        console.log(`  Precision: ${(cP*100).toFixed(1)}%`);
        console.log(`  Recall:    ${(cR*100).toFixed(1)}%`);
        console.log(`  F1 Score:  ${(cF1*100).toFixed(1)}%`);
        console.log(`  Time:      ${results.cnn.time}ms`);

        const improvement = ((cF1 - tF1) / tF1 * 100);
        console.log(`\nCNN vs Template: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}% F1 improvement`);
    }

    // Cleanup
    templates.forEach(t => t.canvas = null);
    templateTensors.forEach(t => t.dispose());
    cnnEmbeddings.forEach(t => t.dispose());
}

compare().catch(console.error);
