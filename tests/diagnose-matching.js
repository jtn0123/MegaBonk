#!/usr/bin/env node
// Diagnose why template matching is failing
// Shows detected cells, their best matches, and confidence scores

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, ImageData } = require('canvas');
globalThis.ImageData = ImageData;

const GT_PATH = './test-images/gameplay/ground-truth.json';
const OUTPUT_DIR = './test-results/matching-diagnosis';

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
            positions.push({ x: startX + i * cellWidth, y: rowY, width: iconSize, height: iconSize, col: i });
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
    return { isEmpty: variance < 350 || mean < 30, variance, mean };
}

// Different matching approaches
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

function calculateColorHistogramSimilarity(d1, d2, bins = 16) {
    const hist1 = { r: new Array(bins).fill(0), g: new Array(bins).fill(0), b: new Array(bins).fill(0) };
    const hist2 = { r: new Array(bins).fill(0), g: new Array(bins).fill(0), b: new Array(bins).fill(0) };

    const binSize = 256 / bins;
    for (let i = 0; i < d1.data.length; i += 4) {
        hist1.r[Math.floor(d1.data[i] / binSize)]++;
        hist1.g[Math.floor(d1.data[i+1] / binSize)]++;
        hist1.b[Math.floor(d1.data[i+2] / binSize)]++;
    }
    for (let i = 0; i < d2.data.length; i += 4) {
        hist2.r[Math.floor(d2.data[i] / binSize)]++;
        hist2.g[Math.floor(d2.data[i+1] / binSize)]++;
        hist2.b[Math.floor(d2.data[i+2] / binSize)]++;
    }

    // Normalize and calculate intersection
    const n1 = d1.data.length / 4, n2 = d2.data.length / 4;
    let intersection = 0;
    for (let i = 0; i < bins; i++) {
        intersection += Math.min(hist1.r[i]/n1, hist2.r[i]/n2);
        intersection += Math.min(hist1.g[i]/n1, hist2.g[i]/n2);
        intersection += Math.min(hist1.b[i]/n1, hist2.b[i]/n2);
    }
    return intersection / 3;
}

function extractEdges(imageData) {
    const w = imageData.width, h = imageData.height;
    const gray = new Float32Array(w * h);
    const edges = new Float32Array(w * h);

    // Convert to grayscale
    for (let i = 0; i < w * h; i++) {
        gray[i] = (imageData.data[i*4] + imageData.data[i*4+1] + imageData.data[i*4+2]) / 3;
    }

    // Simple Sobel edge detection
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const gx = gray[(y-1)*w + x+1] - gray[(y-1)*w + x-1] +
                      2*gray[y*w + x+1] - 2*gray[y*w + x-1] +
                      gray[(y+1)*w + x+1] - gray[(y+1)*w + x-1];
            const gy = gray[(y+1)*w + x-1] - gray[(y-1)*w + x-1] +
                      2*gray[(y+1)*w + x] - 2*gray[(y-1)*w + x] +
                      gray[(y+1)*w + x+1] - gray[(y-1)*w + x+1];
            edges[y * w + x] = Math.sqrt(gx*gx + gy*gy);
        }
    }
    return { edges, width: w, height: h };
}

function calculateEdgeSimilarity(e1, e2) {
    const len = Math.min(e1.edges.length, e2.edges.length);
    let s1 = 0, s2 = 0, sp = 0, ss1 = 0, ss2 = 0;
    for (let i = 0; i < len; i++) {
        s1 += e1.edges[i]; s2 += e2.edges[i];
        sp += e1.edges[i] * e2.edges[i];
        ss1 += e1.edges[i] * e1.edges[i];
        ss2 += e2.edges[i] * e2.edges[i];
    }
    const m1 = s1/len, m2 = s2/len;
    const num = sp/len - m1*m2;
    const den = Math.sqrt((ss1/len - m1*m1) * (ss2/len - m2*m2));
    return den === 0 ? 0 : (num/den + 1) / 2;
}

async function diagnose() {
    console.log('=== Template Matching Diagnosis ===\n');

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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
            templates.set(item.id, {
                item,
                canvas,
                imageData: ctx.getImageData(0, 0, img.width, img.height)
            });
        } catch {}
    }

    console.log(`Loaded ${templates.size} templates\n`);

    // Test on a single image for detailed diagnosis
    const gt = JSON.parse(fs.readFileSync(GT_PATH, 'utf-8'));
    const testImage = 'pc-1080p/level_33_english_forest_early.jpg';
    const testData = gt[testImage];

    if (!testData) {
        console.log('Test image not found in ground truth');
        return;
    }

    const imagePath = path.join('./test-images/gameplay', testImage);
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    console.log(`Analyzing: ${testImage}`);
    console.log(`Resolution: ${image.width}x${image.height}`);
    console.log(`Expected items: ${testData.items.join(', ')}\n`);

    const positions = detectGridPositions(image.width, image.height);
    const scale = image.height / 720;
    const targetSize = Math.round(34 * scale);

    // Analyze each cell
    let cellNum = 0;
    const matchResults = [];

    for (const cell of positions) {
        const cellData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
        const { isEmpty, variance, mean } = isEmptyCell(cellData);

        if (isEmpty) continue;

        cellNum++;
        console.log(`\n--- Cell ${cellNum} at (${cell.x}, ${cell.y}) ---`);
        console.log(`Variance: ${variance.toFixed(0)}, Mean: ${mean.toFixed(0)}`);

        // Resize cell to match template size for comparison
        const resizeCanvas = createCanvas(48, 48);
        const resizeCtx = resizeCanvas.getContext('2d');

        // Extract center portion (skip borders)
        const margin = Math.round(cell.width * 0.15);
        const srcCanvas = createCanvas(cell.width, cell.height);
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(cellData, 0, 0);

        resizeCtx.drawImage(srcCanvas, margin, margin,
            cell.width - margin*2, cell.height - margin*2,
            0, 0, 48, 48);
        const resizedCell = resizeCtx.getImageData(0, 0, 48, 48);

        // Compare with all templates using multiple methods
        const scores = [];

        for (const [itemId, template] of templates) {
            // Resize template
            const tempCanvas = createCanvas(48, 48);
            const tempCtx = tempCanvas.getContext('2d');
            const tMargin = Math.round(template.canvas.width * 0.1);
            tempCtx.drawImage(template.canvas, tMargin, tMargin,
                template.canvas.width - tMargin*2, template.canvas.height - tMargin*2,
                0, 0, 48, 48);
            const resizedTemplate = tempCtx.getImageData(0, 0, 48, 48);

            const ncc = calculateNCC(resizedCell, resizedTemplate);
            const hist = calculateColorHistogramSimilarity(resizedCell, resizedTemplate);

            const cellEdges = extractEdges(resizedCell);
            const templateEdges = extractEdges(resizedTemplate);
            const edge = calculateEdgeSimilarity(cellEdges, templateEdges);

            // Combined score
            const combined = (ncc + hist + edge) / 3;

            scores.push({ itemId, name: template.item.name, ncc, hist, edge, combined });
        }

        // Sort by combined score
        scores.sort((a, b) => b.combined - a.combined);

        // Show top 5 matches
        console.log('Top 5 matches:');
        for (let i = 0; i < 5 && i < scores.length; i++) {
            const s = scores[i];
            console.log(`  ${i+1}. ${s.name.padEnd(25)} NCC=${(s.ncc*100).toFixed(1)}% Hist=${(s.hist*100).toFixed(1)}% Edge=${(s.edge*100).toFixed(1)}% Combined=${(s.combined*100).toFixed(1)}%`);
        }

        matchResults.push({
            cell,
            cellNum,
            variance,
            topMatch: scores[0],
            topMatches: scores.slice(0, 5)
        });

        if (cellNum >= 15) break; // Limit for readability
    }

    // Create visualization
    const vizCanvas = createCanvas(image.width, image.height + 200);
    const vizCtx = vizCanvas.getContext('2d');
    vizCtx.drawImage(image, 0, 0);

    for (const result of matchResults) {
        const { cell, topMatch } = result;

        // Draw cell box
        const isGoodMatch = topMatch.combined > 0.5;
        vizCtx.strokeStyle = isGoodMatch ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)';
        vizCtx.lineWidth = 2;
        vizCtx.strokeRect(cell.x, cell.y, cell.width, cell.height);

        // Label with best match
        vizCtx.fillStyle = isGoodMatch ? 'rgba(0, 100, 0, 0.8)' : 'rgba(100, 0, 0, 0.8)';
        vizCtx.fillRect(cell.x, cell.y - 12, 60, 12);
        vizCtx.fillStyle = '#fff';
        vizCtx.font = '9px monospace';
        vizCtx.fillText(`${(topMatch.combined*100).toFixed(0)}%`, cell.x + 2, cell.y - 2);
    }

    // Info panel
    vizCtx.fillStyle = '#1a1a2e';
    vizCtx.fillRect(0, image.height, image.width, 200);
    vizCtx.fillStyle = '#fff';
    vizCtx.font = '11px monospace';

    const lines = [
        `Detected ${matchResults.length} non-empty cells`,
        `Expected items: ${testData.items.length}`,
        '',
        'Score distribution:',
        `  Combined > 60%: ${matchResults.filter(r => r.topMatch.combined > 0.6).length}`,
        `  Combined > 50%: ${matchResults.filter(r => r.topMatch.combined > 0.5).length}`,
        `  Combined > 40%: ${matchResults.filter(r => r.topMatch.combined > 0.4).length}`,
        '',
        'Method comparison (avg for top matches):',
        `  NCC:      ${(matchResults.reduce((s, r) => s + r.topMatch.ncc, 0) / matchResults.length * 100).toFixed(1)}%`,
        `  Histogram: ${(matchResults.reduce((s, r) => s + r.topMatch.hist, 0) / matchResults.length * 100).toFixed(1)}%`,
        `  Edge:     ${(matchResults.reduce((s, r) => s + r.topMatch.edge, 0) / matchResults.length * 100).toFixed(1)}%`
    ];

    lines.forEach((line, i) => vizCtx.fillText(line, 10, image.height + 18 + i * 15));

    const outputPath = path.join(OUTPUT_DIR, 'diagnosis.png');
    fs.writeFileSync(outputPath, vizCanvas.toBuffer('image/png'));
    console.log(`\nVisualization saved: ${outputPath}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const avgNCC = matchResults.reduce((s, r) => s + r.topMatch.ncc, 0) / matchResults.length;
    const avgHist = matchResults.reduce((s, r) => s + r.topMatch.hist, 0) / matchResults.length;
    const avgEdge = matchResults.reduce((s, r) => s + r.topMatch.edge, 0) / matchResults.length;

    console.log(`\nAverage similarity scores for best matches:`);
    console.log(`  NCC (grayscale correlation): ${(avgNCC * 100).toFixed(1)}%`);
    console.log(`  Color histogram:             ${(avgHist * 100).toFixed(1)}%`);
    console.log(`  Edge similarity:             ${(avgEdge * 100).toFixed(1)}%`);

    if (avgHist > avgNCC && avgHist > avgEdge) {
        console.log(`\n→ COLOR HISTOGRAM performs best - items may have distinctive colors`);
    } else if (avgEdge > avgNCC && avgEdge > avgHist) {
        console.log(`\n→ EDGE DETECTION performs best - shapes are more consistent than colors`);
    } else {
        console.log(`\n→ NCC performs best - grayscale patterns are most reliable`);
    }

    const highConfidence = matchResults.filter(r => r.topMatch.combined > 0.55).length;
    console.log(`\nHigh confidence matches (>55%): ${highConfidence}/${matchResults.length}`);

    if (highConfidence < matchResults.length * 0.3) {
        console.log('\nPOSSIBLE ISSUES:');
        console.log('  - Templates look different from in-game icons');
        console.log('  - Game applies effects (glow, background) not in templates');
        console.log('  - Scale mismatch between templates and detected cells');
        console.log('  - Consider extracting templates directly from screenshots');
    }
}

diagnose().catch(console.error);
