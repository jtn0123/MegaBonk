#!/usr/bin/env node
// Smart extraction with auto-labeling using template similarity

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './training-data/smart-extracted';

// Calibrated grid
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

function getCellStats(imageData) {
    let sum = 0, sumSq = 0, count = 0;
    let sumR = 0, sumG = 0, sumB = 0;
    let edgeSum = 0;

    const w = imageData.width, h = imageData.height;
    const gray = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
        sum += gray[i]; sumSq += gray[i] * gray[i];
        sumR += imageData.data[i*4];
        sumG += imageData.data[i*4+1];
        sumB += imageData.data[i*4+2];
        count++;
    }

    // Simple edge count (Sobel magnitude > threshold)
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = gray[(y-1)*w + x+1] - gray[(y-1)*w + x-1] +
                      2*gray[y*w + x+1] - 2*gray[y*w + x-1] +
                      gray[(y+1)*w + x+1] - gray[(y+1)*w + x-1];
            const gy = gray[(y+1)*w + x-1] - gray[(y-1)*w + x-1] +
                      2*gray[(y+1)*w + x] - 2*gray[(y-1)*w + x] +
                      gray[(y+1)*w + x+1] - gray[(y-1)*w + x+1];
            if (Math.sqrt(gx*gx + gy*gy) > 30) edgeSum++;
        }
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const edgeDensity = edgeSum / ((w-2) * (h-2));

    return { mean, variance, edgeDensity, avgR: sumR/count, avgG: sumG/count, avgB: sumB/count };
}

// Stricter empty detection using multiple criteria
function isLikelyEmpty(stats, biome = 'default') {
    // Items have: high variance, significant edges, non-uniform color
    const varianceThreshold = biome === 'hell' ? 400 : 350;
    const edgeThreshold = biome === 'hell' ? 0.08 : 0.06;

    if (stats.variance < varianceThreshold) return true;
    if (stats.edgeDensity < edgeThreshold) return true;
    if (stats.mean < 25) return true;  // Too dark

    return false;
}

// Simple NCC for template comparison
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

async function extract() {
    console.log('=== Smart Extraction with Auto-Labeling ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Load wiki templates for auto-labeling
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
            templates.set(item.id, { item, imageData: ctx.getImageData(0, 0, 32, 32) });
        } catch {}
    }

    console.log(`Loaded ${templates.size} wiki templates for matching\n`);

    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testCases = Object.entries(gt).filter(([k]) => !k.startsWith('_'));

    const extractedItems = [];
    let totalDetected = 0;
    let totalExpected = 0;
    let totalFiltered = 0;

    for (const [name, data] of testCases) {
        const imagePath = path.join('./test-images/gameplay', name);
        if (!fs.existsSync(imagePath)) continue;

        // Detect biome from filename
        const biome = name.includes('hell') ? 'hell' : 'default';

        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const positions = detectGridPositions(image.width, image.height);

        // Expected items for this image
        const expectedItems = data.items.map(item =>
            item.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        );
        const expectedCounts = new Map();
        expectedItems.forEach(id => expectedCounts.set(id, (expectedCounts.get(id) || 0) + 1));

        // Analyze cells with stricter filtering
        const cells = [];
        let filtered = 0;

        for (const pos of positions) {
            const cellData = ctx.getImageData(pos.x, pos.y, pos.width, pos.height);
            const stats = getCellStats(cellData);

            if (isLikelyEmpty(stats, biome)) {
                filtered++;
                continue;
            }

            // Resize for template matching
            const resizeCanvas = createCanvas(32, 32);
            const resizeCtx = resizeCanvas.getContext('2d');
            const srcCanvas = createCanvas(pos.width, pos.height);
            srcCanvas.getContext('2d').putImageData(cellData, 0, 0);
            const margin = Math.round(pos.width * 0.12);
            resizeCtx.drawImage(srcCanvas, margin, margin, pos.width - margin*2, pos.height - margin*2, 0, 0, 32, 32);
            const resizedData = resizeCtx.getImageData(0, 0, 32, 32);

            // Find best template match
            let bestMatch = null;
            let bestScore = 0;
            for (const [id, template] of templates) {
                const score = calculateNCC(resizedData, template.imageData);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = id;
                }
            }

            cells.push({
                pos,
                stats,
                resizedData,
                resizeCanvas,
                bestMatch,
                bestScore,
                // Check if best match is in expected items
                matchInExpected: expectedCounts.has(bestMatch)
            });
        }

        totalDetected += cells.length;
        totalExpected += expectedItems.length;
        totalFiltered += filtered;

        // Report for this image
        const matchedCount = cells.filter(c => c.matchInExpected && c.bestScore > 0.4).length;
        console.log(`${name.slice(9, 40)}`);
        console.log(`  Detected: ${cells.length} | Expected: ${expectedItems.length} | Filtered: ${filtered}`);
        console.log(`  Matches in expected: ${matchedCount} (${(matchedCount/cells.length*100).toFixed(0)}%)`);

        // Extract crops with auto-labels
        for (const cell of cells) {
            // Determine label confidence
            let label = null;
            let confidence = 'low';

            if (cell.matchInExpected && cell.bestScore > 0.5) {
                label = cell.bestMatch;
                confidence = 'high';
            } else if (cell.matchInExpected && cell.bestScore > 0.4) {
                label = cell.bestMatch;
                confidence = 'medium';
            } else {
                label = `unknown_${cell.bestMatch}`;
                confidence = 'low';
            }

            extractedItems.push({
                source: name,
                label,
                confidence,
                bestScore: cell.bestScore,
                canvas: cell.resizeCanvas
            });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('EXTRACTION SUMMARY');
    console.log('='.repeat(60));

    console.log(`\nTotal detected: ${totalDetected}`);
    console.log(`Total expected: ${totalExpected}`);
    console.log(`Total filtered (empty): ${totalFiltered}`);
    console.log(`Detection accuracy: ${((1 - Math.abs(totalDetected - totalExpected) / totalExpected) * 100).toFixed(1)}%`);

    const highConf = extractedItems.filter(i => i.confidence === 'high').length;
    const medConf = extractedItems.filter(i => i.confidence === 'medium').length;
    const lowConf = extractedItems.filter(i => i.confidence === 'low').length;

    console.log(`\nLabel confidence distribution:`);
    console.log(`  High (score > 0.5, in expected): ${highConf} (${(highConf/totalDetected*100).toFixed(1)}%)`);
    console.log(`  Medium (score > 0.4, in expected): ${medConf} (${(medConf/totalDetected*100).toFixed(1)}%)`);
    console.log(`  Low (unknown): ${lowConf} (${(lowConf/totalDetected*100).toFixed(1)}%)`);

    // Save high-confidence items grouped by label
    const highConfByLabel = new Map();
    for (const item of extractedItems.filter(i => i.confidence === 'high')) {
        if (!highConfByLabel.has(item.label)) {
            highConfByLabel.set(item.label, []);
        }
        highConfByLabel.get(item.label).push(item);
    }

    console.log(`\nHigh-confidence items by type: ${highConfByLabel.size} unique items`);

    // Save to folders
    for (const [label, items] of highConfByLabel) {
        const labelDir = path.join(OUTPUT_DIR, 'high-confidence', label);
        fs.mkdirSync(labelDir, { recursive: true });

        for (let i = 0; i < items.length; i++) {
            fs.writeFileSync(
                path.join(labelDir, `${label}_${i}.png`),
                items[i].canvas.toBuffer('image/png')
            );
        }
    }

    // Create review montage for manual verification
    const sortedItems = extractedItems
        .filter(i => i.confidence === 'high')
        .sort((a, b) => b.bestScore - a.bestScore)
        .slice(0, 100);

    if (sortedItems.length > 0) {
        const cols = 10;
        const rows = Math.ceil(sortedItems.length / cols);
        const cellSize = 40;

        const montage = createCanvas(cols * cellSize, rows * cellSize);
        const mCtx = montage.getContext('2d');
        mCtx.fillStyle = '#1a1a2e';
        mCtx.fillRect(0, 0, montage.width, montage.height);

        for (let i = 0; i < sortedItems.length; i++) {
            const item = sortedItems[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * cellSize + 2;
            const y = row * cellSize + 2;

            mCtx.drawImage(item.canvas, x, y, cellSize - 4, cellSize - 4);

            // Score overlay
            mCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            mCtx.fillRect(x, y + cellSize - 14, cellSize - 4, 12);
            mCtx.fillStyle = '#0f0';
            mCtx.font = '8px monospace';
            mCtx.fillText(`${(item.bestScore*100).toFixed(0)}%`, x + 2, y + cellSize - 4);
        }

        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'high-confidence-montage.png'),
            montage.toBuffer('image/png')
        );
        console.log(`\nHigh-confidence montage saved: ${OUTPUT_DIR}/high-confidence-montage.png`);
    }

    console.log(`\nTemplates saved to: ${OUTPUT_DIR}/`);
}

extract().catch(console.error);
